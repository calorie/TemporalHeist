use std::time::Duration;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let outgoing = moq_net::Origin::random().produce();
    let incoming = moq_net::Origin::random().produce();
    let client = moq_native::ClientConfig::default().init()?
        .with_publisher(outgoing.consume())
        .with_subscriber(incoming.clone());
    let session = client.connect(url::Url::parse("http://relay:4443/anon")?).await?;
    println!("connected {:?}", session.version());
    let mut broadcast = outgoing.create_broadcast("spike/authority", moq_net::broadcast::Route::announced())?;
    let mut track = broadcast.create_track("reply", moq_net::track::Info::default().with_latency_max(Duration::from_secs(30)))?;
    let input = incoming.consume().announced_broadcast("spike/browser").await.ok_or_else(|| anyhow::anyhow!("input absent"))?;
    let mut subscription = input.track("input")?.subscribe(moq_net::track::Subscription::default().with_latency_max(Duration::from_secs(30)).with_ordered(true)).await?;
    while let Some(mut group) = subscription.recv_group().await? {
        while let Some(frame) = group.read_frame().await? {
            assert_eq!(frame.payload.as_ref(), b"browser-to-rust");
            println!("received {:?}", frame);
            let mut reply = track.append_group()?;
            reply.write_frame(moq_net::Timestamp::now(), b"rust-to-browser".to_vec())?;
            reply.finish()?;
        }
    }
    Ok(())
}
