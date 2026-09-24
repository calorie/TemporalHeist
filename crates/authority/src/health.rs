use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

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
        let health = health.clone();
        tokio::spawn(async move {
            let mut request = [0_u8; 1024];
            let size = stream.read(&mut request).await.unwrap_or(0);
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
            let _ = stream.write_all(response.as_bytes()).await;
        });
    }
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
}
