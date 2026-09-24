use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    net::TcpListener,
    time::{Duration, timeout},
};
const IO_TIMEOUT: Duration = Duration::from_millis(250);

#[derive(Clone, Default)]
pub struct Health {
    ready: Arc<AtomicBool>,
}

impl Health {
    pub fn set_ready(&self, ready: bool) {
        self.ready.store(ready, Ordering::Release);
    }
    fn response(&self, path: &str) -> (&'static str, &'static str) {
        match path {
            "/healthz" => ("200 OK", "ok\n"),
            "/readyz" if self.ready.load(Ordering::Acquire) => ("200 OK", "ready\n"),
            "/readyz" => ("503 Service Unavailable", "not ready\n"),
            _ => ("404 Not Found", "not found\n"),
        }
    }
}

pub async fn serve(health: Health, address: &str) -> anyhow::Result<()> {
    let listener = TcpListener::bind(address).await?;
    loop {
        let (mut stream, _) = listener.accept().await?;
        let _ = handle(&health, &mut stream).await;
    }
}

async fn handle<S: AsyncRead + AsyncWrite + Unpin>(
    health: &Health,
    stream: &mut S,
) -> anyhow::Result<()> {
    timeout(IO_TIMEOUT, async {
        let mut request = [0_u8; 1024];
        let size = stream.read(&mut request).await?;
        let path = std::str::from_utf8(&request[..size])
            .ok()
            .and_then(|line| line.lines().next())
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("");
        let (status, body) = health.response(path);
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).await?;
        Ok::<_, std::io::Error>(())
    })
    .await??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn liveness_is_independent_from_publication_readiness() {
        let health = Health::default();
        assert_eq!(health.response("/healthz").0, "200 OK");
        assert_eq!(health.response("/readyz").0, "503 Service Unavailable");
        health.set_ready(true);
        assert_eq!(health.response("/readyz").0, "200 OK");
        health.set_ready(false);
        assert_eq!(health.response("/readyz").0, "503 Service Unavailable");
        assert_eq!(health.response("/healthz/ ").0, "404 Not Found");
    }

    #[tokio::test]
    async fn slow_client_is_bounded_by_io_timeout() {
        let health = Health::default();
        let (mut server, _client) = tokio::io::duplex(32);
        assert!(
            timeout(Duration::from_secs(1), handle(&health, &mut server))
                .await
                .unwrap()
                .is_err()
        );
    }
}
