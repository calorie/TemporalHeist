use std::{
    collections::VecDeque,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use prost::Message;
use th_protocol::{Input, MAX_INPUT_BYTES, PROTOCOL_MAJOR, Snapshot, TICK_RATE, TimelineChunk};
use tokio::sync::mpsc;

pub const SNAPSHOT_INTERVAL_TICKS: u64 = 3;
pub const NETWORK_HISTORY_TICKS: u64 = 660;
pub const GROUP_INTERVAL_TICKS: u64 = TICK_RATE;
pub const TRACK_RETENTION: Duration = Duration::from_secs(30);
pub const MAX_PENDING_INPUTS: usize = 1024;
pub const OUTPUT_QUEUE_CAPACITY: usize = 128;
pub const MAX_SNAPSHOT_BYTES: usize = 64 * 1024;
pub const MAX_HISTORY_BYTES: usize = 2 * 1024 * 1024;

static EPOCH_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn fresh_room_epoch(room_id: &str) -> String {
    let started = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = EPOCH_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{room_id}-{started:x}-{:x}-{counter:x}", std::process::id())
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrackNames {
    pub authority_broadcast: String,
    pub world: &'static str,
    pub history: &'static str,
    pub player_inputs: [PlayerInputTracks; 2],
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerInputTracks {
    pub broadcast: String,
    pub motion: &'static str,
    pub actions: &'static str,
}

impl TrackNames {
    pub fn for_room(room_id: &str) -> anyhow::Result<Self> {
        if room_id.is_empty() || room_id.contains('/') {
            anyhow::bail!("TH_ROOM_ID must be non-empty and contain no slash");
        }
        let input = |player_id| PlayerInputTracks {
            broadcast: format!("th/room/{room_id}/input/{player_id}"),
            motion: "motion",
            actions: "actions",
        };
        Ok(Self {
            authority_broadcast: format!("th/room/{room_id}/authority"),
            world: "world",
            history: "history",
            player_inputs: [input(1), input(2)],
        })
    }
}

#[derive(Clone, Debug)]
pub struct PublishedTick {
    pub snapshot: Snapshot,
    pub history: Option<TimelineChunk>,
}

/// Network-free authority core. Simulation owns gameplay and idempotency;
/// authority owns the 60 Hz cadence and replication sampling.
pub struct Authority {
    world: th_sim::World,
    pending: Vec<Input>,
    network_history: VecDeque<Snapshot>,
}

impl Authority {
    pub fn new(epoch: String) -> Self {
        Self {
            world: th_sim::World::new(epoch),
            pending: Vec::new(),
            network_history: VecDeque::new(),
        }
    }

    pub fn accept_frame(&mut self, bytes: &[u8]) -> anyhow::Result<()> {
        if self.pending.len() >= MAX_PENDING_INPUTS {
            anyhow::bail!("pending input limit of {MAX_PENDING_INPUTS} reached");
        }
        self.pending.push(decode_input(bytes)?);
        Ok(())
    }

    pub fn tick(&mut self) -> Option<PublishedTick> {
        let snapshot = self.world.step(&self.pending);
        self.pending.clear();
        if !snapshot.server_tick.is_multiple_of(SNAPSHOT_INTERVAL_TICKS) {
            return None;
        }
        self.network_history.push_back(snapshot.clone());
        while self.network_history.front().is_some_and(|sample| {
            sample.server_tick.saturating_add(NETWORK_HISTORY_TICKS) < snapshot.server_tick
        }) {
            self.network_history.pop_front();
        }
        let history = snapshot
            .server_tick
            .is_multiple_of(GROUP_INTERVAL_TICKS)
            .then(|| TimelineChunk {
                protocol_major: PROTOCOL_MAJOR,
                room_epoch: snapshot.room_epoch.clone(),
                samples: self.network_history.iter().cloned().collect(),
            });
        Some(PublishedTick { snapshot, history })
    }
}

pub fn decode_input(bytes: &[u8]) -> anyhow::Result<Input> {
    if bytes.len() > MAX_INPUT_BYTES {
        anyhow::bail!("input frame exceeds {MAX_INPUT_BYTES} bytes");
    }
    Input::decode(bytes).map_err(Into::into)
}

pub fn decode_input_for_player(bytes: &[u8], expected_player_id: u32) -> anyhow::Result<Input> {
    let input = decode_input(bytes)?;
    if input.player_id != expected_player_id {
        anyhow::bail!(
            "player track {expected_player_id} rejected payload for player {}",
            input.player_id
        );
    }
    Ok(input)
}

fn bounded_payload(payload: Vec<u8>, limit: usize, kind: &str) -> anyhow::Result<Vec<u8>> {
    anyhow::ensure!(
        payload.len() <= limit,
        "{kind} payload of {} bytes exceeds {limit}",
        payload.len()
    );
    Ok(payload)
}
pub fn encode_snapshot(snapshot: &Snapshot) -> anyhow::Result<Vec<u8>> {
    bounded_payload(snapshot.encode_to_vec(), MAX_SNAPSHOT_BYTES, "snapshot")
}
pub fn encode_history(history: &TimelineChunk) -> anyhow::Result<Vec<u8>> {
    bounded_payload(history.encode_to_vec(), MAX_HISTORY_BYTES, "history")
}

fn try_publish(output: &mpsc::Sender<PublishedTick>, published: PublishedTick) -> bool {
    match output.try_send(published) {
        Ok(()) => true,
        Err(mpsc::error::TrySendError::Full(dropped)) => {
            tracing::warn!(
                server_tick = dropped.snapshot.server_tick,
                "dropping replication frame under network backpressure"
            );
            true
        }
        Err(mpsc::error::TrySendError::Closed(_)) => false,
    }
}

pub async fn run_authority(
    epoch: String,
    mut input: mpsc::Receiver<Vec<u8>>,
    output: mpsc::Sender<PublishedTick>,
) -> anyhow::Result<()> {
    let mut authority = Authority::new(epoch);
    let mut ticker = tokio::time::interval(Duration::from_secs_f64(1.0 / TICK_RATE as f64));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Burst);
    loop {
        tokio::select! {
            biased;
            _ = ticker.tick() => if let Some(published) = authority.tick()
                && !try_publish(&output, published) { return Ok(()); },
            frame = input.recv() => match frame {
                Some(frame) => if let Err(error) = authority.accept_frame(&frame) {
                    tracing::warn!(error = %error, bytes = frame.len(), "rejected input frame");
                },
                None => return Ok(()),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use th_protocol::{InputKind, Session};

    #[test]
    fn generated_room_epochs_change_across_authority_restarts() {
        let first = fresh_room_epoch("room-a");
        let second = fresh_room_epoch("room-a");

        assert!(first.starts_with("room-a-"));
        assert!(second.starts_with("room-a-"));
        assert_ne!(first, second);
    }

    fn snapshot(tick: u64) -> Snapshot {
        Snapshot {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "epoch-test".into(),
            server_tick: tick,
            players: vec![],
            echoes: vec![],
            plates: vec![],
            doors: vec![],
            actions: vec![],
            sessions: vec![Session {
                player_id: 1,
                session_id: "s".into(),
                connected: true,
                ready: false,
            }],
            room: None,
            hazards: vec![],
            guards: vec![],
        }
    }

    #[test]
    fn exact_track_names() {
        let names = TrackNames::for_room("acceptance").unwrap();
        assert_eq!(names.authority_broadcast, "th/room/acceptance/authority");
        assert_eq!(
            names.player_inputs[1].broadcast,
            "th/room/acceptance/input/2"
        );
        assert_eq!((names.world, names.history), ("world", "history"));
        assert_eq!(
            (
                names.player_inputs[0].motion,
                names.player_inputs[0].actions
            ),
            ("motion", "actions")
        );
        assert!(TrackNames::for_room("bad/room").is_err());
    }

    #[test]
    fn protobuf_frames_are_independently_decodable() {
        let input = Input {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "epoch-test".into(),
            player_id: 1,
            session_id: "s".into(),
            sequence: 9,
            move_x: -1000,
            move_z: 1000,
            kind: InputKind::Motion as i32,
            target_id: 0,
        };
        assert_eq!(decode_input(&input.encode_to_vec()).unwrap(), input);
        assert_eq!(
            Snapshot::decode(encode_snapshot(&snapshot(3)).unwrap().as_slice()).unwrap(),
            snapshot(3)
        );
        let chunk = TimelineChunk {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "epoch-test".into(),
            samples: vec![snapshot(3)],
        };
        assert_eq!(
            TimelineChunk::decode(encode_history(&chunk).unwrap().as_slice()).unwrap(),
            chunk
        );
    }

    #[test]
    fn oversized_input_is_rejected_before_decode() {
        assert!(decode_input(&vec![0; MAX_INPUT_BYTES + 1]).is_err());
    }

    #[test]
    fn player_track_rejects_a_payload_claiming_another_player() {
        let forged = Input {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "epoch-test".into(),
            player_id: 2,
            session_id: "stolen-session".into(),
            sequence: u64::MAX,
            move_x: 1000,
            move_z: 0,
            kind: InputKind::Motion as i32,
            target_id: 0,
        }
        .encode_to_vec();
        assert!(decode_input_for_player(&forged, 1).is_err());
        assert_eq!(decode_input_for_player(&forged, 2).unwrap().player_id, 2);
    }

    #[test]
    fn pending_input_queue_is_bounded_between_ticks() {
        let mut authority = Authority::new("epoch-test".into());
        let frame = Input {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "epoch-test".into(),
            player_id: 1,
            session_id: "s".into(),
            sequence: 1,
            move_x: 0,
            move_z: 0,
            kind: InputKind::Join as i32,
            target_id: 0,
        }
        .encode_to_vec();
        for _ in 0..MAX_PENDING_INPUTS {
            authority.accept_frame(&frame).unwrap();
        }
        assert!(authority.accept_frame(&frame).is_err());
    }

    #[tokio::test]
    async fn replication_backpressure_drops_instead_of_waiting() {
        let (tx, mut rx) = mpsc::channel(1);
        assert!(try_publish(
            &tx,
            PublishedTick {
                snapshot: snapshot(3),
                history: None
            }
        ));
        assert!(try_publish(
            &tx,
            PublishedTick {
                snapshot: snapshot(6),
                history: None
            }
        ));
        assert_eq!(rx.recv().await.unwrap().snapshot.server_tick, 3);
        drop(rx);
        assert!(!try_publish(
            &tx,
            PublishedTick {
                snapshot: snapshot(9),
                history: None
            }
        ));
    }

    #[test]
    fn network_history_is_bounded_by_660_ticks() {
        let mut samples = VecDeque::new();
        for tick in (3..=900).step_by(SNAPSHOT_INTERVAL_TICKS as usize) {
            samples.push_back(snapshot(tick));
            while samples
                .front()
                .is_some_and(|s| s.server_tick + NETWORK_HISTORY_TICKS < tick)
            {
                samples.pop_front();
            }
        }
        assert_eq!(samples.front().unwrap().server_tick, 240);
        assert_eq!(samples.back().unwrap().server_tick, 900);
        assert_eq!(samples.len(), 221);
    }

    #[test]
    fn six_hour_virtual_soak_keeps_resources_and_payloads_bounded() {
        let mut authority = Authority::new("soak-epoch".into());
        let mut max_history_samples = 0;
        let mut max_snapshot_bytes = 0;
        let mut max_history_bytes = 0;
        let mut max_actions = 0;
        let mut active_samples = 0;
        let mut sequence = [0_u64; 2];
        let mut submitted_actions = 0_usize;
        for tick in 0..216_000 {
            for (index, player_id) in [1_u32, 2].into_iter().enumerate() {
                sequence[index] += 1;
                let kind = if tick == 0 {
                    InputKind::Join
                } else if tick == 1 {
                    InputKind::Ready
                } else if tick % 30 == 0 {
                    submitted_actions += 1;
                    InputKind::Action
                } else {
                    InputKind::Motion
                };
                let frame = Input {
                    protocol_major: PROTOCOL_MAJOR,
                    room_epoch: "soak-epoch".into(),
                    player_id,
                    session_id: format!("soak-{player_id}"),
                    sequence: sequence[index],
                    move_x: if tick % 120 < 60 { 250 } else { -250 },
                    move_z: 0,
                    kind: kind as i32,
                    target_id: if kind == InputKind::Action { 61 } else { 0 },
                }
                .encode_to_vec();
                authority.accept_frame(&frame).unwrap();
            }
            if let Some(published) = authority.tick() {
                max_actions = max_actions.max(published.snapshot.actions.len());
                if published
                    .snapshot
                    .room
                    .as_ref()
                    .is_some_and(|room| room.phase == 2)
                {
                    active_samples += 1;
                }
                max_snapshot_bytes =
                    max_snapshot_bytes.max(encode_snapshot(&published.snapshot).unwrap().len());
                if let Some(history) = published.history {
                    max_history_samples = max_history_samples.max(history.samples.len());
                    max_history_bytes =
                        max_history_bytes.max(encode_history(&history).unwrap().len());
                }
            }
        }
        assert!(submitted_actions > 10_000);
        assert!(active_samples > 1_000);
        assert!(max_actions <= 3_601, "action maximum was {max_actions}");
        assert!(authority.pending.len() <= MAX_PENDING_INPUTS);
        assert!(
            authority.network_history.len()
                <= NETWORK_HISTORY_TICKS as usize / SNAPSHOT_INTERVAL_TICKS as usize + 1
        );
        assert!(max_history_samples <= 221);
        assert!(
            max_snapshot_bytes <= MAX_SNAPSHOT_BYTES,
            "snapshot maximum was {max_snapshot_bytes}"
        );
        assert!(
            max_history_bytes <= MAX_HISTORY_BYTES,
            "history maximum was {max_history_bytes}"
        );
    }

    #[test]
    fn publication_payload_limit_accepts_boundary_and_rejects_overflow() {
        assert_eq!(
            bounded_payload(vec![0; MAX_SNAPSHOT_BYTES], MAX_SNAPSHOT_BYTES, "snapshot")
                .unwrap()
                .len(),
            MAX_SNAPSHOT_BYTES
        );
        assert!(
            bounded_payload(
                vec![0; MAX_SNAPSHOT_BYTES + 1],
                MAX_SNAPSHOT_BYTES,
                "snapshot"
            )
            .is_err()
        );
        let mut oversized = snapshot(3);
        oversized.sessions[0].session_id = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
        assert!(encode_snapshot(&oversized).is_err());
    }
}
