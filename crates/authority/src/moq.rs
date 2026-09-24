use std::time::Duration;

use crate::health::Health;
use anyhow::Context;
use moq_net::track::{Info, Subscription};
use tokio::sync::mpsc;

use th_authority::{
    GROUP_INTERVAL_TICKS, PublishedTick, TRACK_RETENTION, TrackNames, decode_input_for_player,
    encode_history, encode_snapshot,
};

pub async fn run(
    relay_url: url::Url,
    names: TrackNames,
    input_tx: mpsc::Sender<Vec<u8>>,
    mut output_rx: mpsc::Receiver<PublishedTick>,
    health: Health,
    room_epoch: String,
) -> anyhow::Result<()> {
    loop {
        health.set_ready(false);
        match run_session(
            &relay_url,
            &names,
            &input_tx,
            &mut output_rx,
            &health,
            &room_epoch,
        )
        .await
        {
            Ok(()) if output_rx.is_closed() => return Ok(()),
            Ok(()) => tracing::warn!(
                event = "relay_degraded",
                room_epoch,
                "MoQ session ended; reconnecting"
            ),
            Err(error) => {
                tracing::warn!(event = "relay_degraded", room_epoch, error = %error, "MoQ session failed; reconnecting")
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

async fn run_session(
    relay_url: &url::Url,
    names: &TrackNames,
    input_tx: &mpsc::Sender<Vec<u8>>,
    output_rx: &mut mpsc::Receiver<PublishedTick>,
    health: &Health,
    room_epoch: &str,
) -> anyhow::Result<()> {
    let outgoing = moq_net::Origin::random().produce();
    let incoming = moq_net::Origin::random().produce();
    let mut config = moq_native::ClientConfig::default();
    config.backoff.timeout = Duration::ZERO;
    let client = config
        .init()
        .context("initialize MoQ client")?
        .with_publisher(outgoing.consume())
        .with_subscriber(incoming.clone());
    let mut connection = client.reconnect(relay_url.clone());
    while !connection.connected() {
        connection.status().await.context("connect to MoQ relay")?;
    }
    health.set_ready(true);
    tracing::info!(event = "relay_recovered", room_epoch, version = ?connection.version(), "connected to MoQ relay");

    let mut authority = outgoing
        .create_broadcast(
            &names.authority_broadcast,
            moq_net::broadcast::Route::announced(),
        )
        .context("create authority broadcast")?;
    let info = || Info::default().with_latency_max(TRACK_RETENTION);
    let mut world = authority
        .create_track(names.world, info())
        .context("create world track")?;
    let mut history = authority
        .create_track(names.history, info())
        .context("create history track")?;

    let mut readers = tokio::task::JoinSet::new();
    for (index, player) in names.player_inputs.iter().cloned().enumerate() {
        for track in [player.motion, player.actions] {
            readers.spawn(read_track(
                incoming.clone(),
                player.broadcast.clone(),
                track,
                index as u32 + 1,
                input_tx.clone(),
            ));
        }
    }
    let mut world_group = world.append_group().context("open initial world group")?;
    let mut group_start_tick = None;
    loop {
        tokio::select! {
            status = connection.status() => match status.context("observe MoQ relay status")? {
                moq_native::Status::Connected => {
                    health.set_ready(true);
                    tracing::info!(event = "relay_recovered", room_epoch, "MoQ relay session recovered");
                }
                moq_native::Status::Disconnected => {
                    health.set_ready(false);
                    tracing::warn!(event = "relay_degraded", room_epoch, "MoQ relay session disconnected");
                }
                _ => health.set_ready(false),
            },
            result = readers.join_next() => match result {
                Some(Ok(Ok(()))) => tracing::warn!("input subscription ended"),
                Some(Ok(Err(error))) => tracing::warn!(error = %error, "input subscription failed"),
                Some(Err(error)) => tracing::warn!(error = %error, "input subscription task failed"),
                None => anyhow::bail!("all input subscriptions ended"),
            },
            published = output_rx.recv() => {
                let Some(published) = published else { return Ok(()) };
                let tick = published.snapshot.server_tick;
                world_group.write_frame(moq_net::Timestamp::now(), encode_snapshot(&published.snapshot)?)
                    .context("publish world frame")?;
                let start = *group_start_tick.get_or_insert(tick);
                if tick.saturating_sub(start) >= GROUP_INTERVAL_TICKS {
                    world_group.finish().context("finish world group")?;
                    world_group = world.append_group().context("open world group")?;
                    group_start_tick = Some(tick);
                }
                if let Some(chunk) = published.history {
                    let mut group = history.append_group().context("open history group")?;
                    group.write_frame(moq_net::Timestamp::now(), encode_history(&chunk)?)
                        .context("publish history frame")?;
                    group.finish().context("finish history group")?;
                    tracing::debug!(server_tick = tick, samples = chunk.samples.len(), "published authority history");
                }
            }
        }
    }
}

async fn read_track(
    incoming: moq_net::origin::Producer,
    broadcast_path: String,
    track_name: &'static str,
    expected_player_id: u32,
    input_tx: mpsc::Sender<Vec<u8>>,
) -> anyhow::Result<()> {
    loop {
        let Some(broadcast) = incoming
            .consume()
            .announced_broadcast(&broadcast_path)
            .await
        else {
            return Ok(());
        };
        let result = async {
            let mut subscription = broadcast
                .track(track_name)?
                .subscribe(
                    Subscription::default()
                        .with_latency_max(Duration::from_secs(30))
                        .with_ordered(true),
                )
                .await
                .with_context(|| format!("subscribe {broadcast_path}/{track_name}"))?;
            tracing::info!(
                broadcast = broadcast_path,
                track = track_name,
                "subscribed to input"
            );
            loop {
                let mut group = tokio::select! {
                    cause = broadcast.closed() => {
                        tracing::info!(
                            error = %cause,
                            broadcast = broadcast_path,
                            track = track_name,
                            "input publisher ended; waiting for replacement"
                        );
                        break;
                    }
                    group = subscription.recv_group() => {
                        let Some(group) = group? else { break };
                        group
                    }
                };
                while let Some(frame) = group.read_frame().await? {
                    if let Err(error) = decode_input_for_player(&frame.payload, expected_player_id)
                    {
                        tracing::warn!(
                            error = %error,
                            broadcast = broadcast_path,
                            track = track_name,
                            "rejected input on mismatched player track"
                        );
                        continue;
                    }
                    input_tx
                        .send(frame.payload.to_vec())
                        .await
                        .context("authority input queue closed")?;
                }
            }
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if input_tx.is_closed() {
            return Ok(());
        }
        if let Err(error) = result {
            tracing::warn!(
                error = %error,
                broadcast = broadcast_path,
                track = track_name,
                "input subscription failed; waiting for publisher"
            );
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}
