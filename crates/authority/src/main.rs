use std::env;

use anyhow::Context;
use th_authority::{TrackNames, fresh_room_epoch, run_authority};
use tokio::sync::mpsc;

mod moq;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let room_id = env::var("TH_ROOM_ID").unwrap_or_else(|_| "dev".into());
    let room_epoch = env::var("TH_ROOM_EPOCH").unwrap_or_else(|_| fresh_room_epoch(&room_id));
    let relay_url = env::var("TH_RELAY_URL").unwrap_or_else(|_| "http://relay:4443/anon".into());
    let names = TrackNames::for_room(&room_id)?;
    let relay_url = url::Url::parse(&relay_url).context("parse TH_RELAY_URL")?;
    let (input_tx, input_rx) = mpsc::channel(1024);
    let (output_tx, output_rx) = mpsc::channel(128);

    tracing::info!(room_id, room_epoch, relay_url = %relay_url, "starting authority");
    let authority = tokio::spawn(run_authority(room_epoch, input_rx, output_tx));
    tokio::select! {
        result = moq::run(relay_url, names, input_tx, output_rx) => result,
        result = authority => result.context("authority task panicked")?,
        signal = tokio::signal::ctrl_c() => {
            signal.context("install shutdown signal")?;
            tracing::info!("shutdown signal received");
            Ok(())
        }
    }
}
