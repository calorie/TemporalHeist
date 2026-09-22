FROM rust:slim-bookworm@sha256:ff521445a372125ed4f76e1453a1f8098f2d05332d1601d30db1c1f62757e730 AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev cmake clang ca-certificates && rm -rf /var/lib/apt/lists/*
RUN cargo install moq-relay --version 0.14.18 --locked --no-default-features --features quinn,websocket --jobs 2
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/cargo/bin/moq-relay /usr/local/bin/moq-relay
ENTRYPOINT ["moq-relay"]
