use std::{
    env,
    io::{Read, Write},
    net::TcpStream,
    time::Duration as StdDuration,
};

use anyhow::Context;
use th_authority::{TrackNames, fresh_room_epoch, run_authority};
use tokio::sync::mpsc;
use tokio::time::{Duration, timeout};

mod health;
mod moq;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if let Some(probe) = env::args()
        .nth(1)
        .and_then(|arg| arg.strip_prefix("--healthcheck=").map(str::to_owned))
    {
        return healthcheck(&probe);
    }
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "th_authority=info".into()),
        )
        .init();
    let room_id = env::var("TH_ROOM_ID").unwrap_or_else(|_| "dev".into());
    let room_epoch = env::var("TH_ROOM_EPOCH").unwrap_or_else(|_| fresh_room_epoch(&room_id));
    let relay_url = env::var("TH_RELAY_URL").unwrap_or_else(|_| "http://relay:4443/anon".into());
    let names = TrackNames::for_room(&room_id)?;
    let relay_url = url::Url::parse(&relay_url).context("parse TH_RELAY_URL")?;
    let (input_tx, input_rx) = mpsc::channel(1024);
    let (output_tx, output_rx) = mpsc::channel(th_authority::OUTPUT_QUEUE_CAPACITY);
    let health = health::Health::default();

    tracing::info!(event = "authority_started", room_id, room_epoch, relay_url = %relay_url);
    let mut authority = tokio::spawn(run_authority(room_epoch.clone(), input_rx, output_tx));
    let mut transport = tokio::spawn(moq::run(
        relay_url,
        names,
        input_tx,
        output_rx,
        health.clone(),
        room_epoch.clone(),
    ));
    let mut health_server = tokio::spawn(health::serve(health, "0.0.0.0:8080"));
    tokio::select! {
        result = &mut transport => result.context("transport task panicked")??,
        result = &mut authority => result.context("authority task panicked")??,
        result = &mut health_server => result.context("health task panicked")??,
        signal = shutdown_signal() => {
            signal.context("install shutdown signal")?;
            tracing::info!(event = "shutdown_started", room_id, room_epoch);
        }
    };
    authority.abort();
    transport.abort();
    health_server.abort();
    let _ = timeout(Duration::from_secs(2), async {
        let _ = authority.await;
        let _ = transport.await;
        let _ = health_server.await;
    })
    .await;
    tracing::info!(event = "shutdown_complete", room_id, room_epoch);
    Ok(())
}

async fn shutdown_signal() -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! {
            result = tokio::signal::ctrl_c() => result?,
            _ = terminate.recv() => {},
        }
        Ok(())
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await.map_err(Into::into)
}

fn healthcheck(probe: &str) -> anyhow::Result<()> {
    let path = match probe {
        "live" => "/healthz",
        "ready" => "/readyz",
        _ => anyhow::bail!("unknown healthcheck"),
    };
    let mut stream =
        TcpStream::connect_timeout(&"127.0.0.1:8080".parse()?, StdDuration::from_secs(1))?;
    stream.set_read_timeout(Some(StdDuration::from_secs(1)))?;
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    )?;
    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    anyhow::ensure!(response.starts_with("HTTP/1.1 200"), "healthcheck failed");
    Ok(())
}
