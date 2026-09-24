FROM rust:slim-bookworm@sha256:ff521445a372125ed4f76e1453a1f8098f2d05332d1601d30db1c1f62757e730 AS authority-build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libssl-dev protobuf-compiler cmake clang ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY map ./map
COPY proto ./proto
RUN cargo build --release --locked -p th-authority

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS authority
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=authority-build /workspace/target/release/th-authority /usr/local/bin/th-authority
ARG TH_RELEASE_SOURCE
ARG TH_RELEASE_REVISION
ARG TH_RELEASE_VERSION
ARG TH_RELEASE_CREATED
LABEL org.opencontainers.image.source=$TH_RELEASE_SOURCE \
      org.opencontainers.image.revision=$TH_RELEASE_REVISION \
      org.opencontainers.image.version=$TH_RELEASE_VERSION \
      org.opencontainers.image.created=$TH_RELEASE_CREATED \
      org.opencontainers.image.title="Temporal Heist Authority"
USER 65532:65532
ENTRYPOINT ["th-authority"]

FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 AS node-deps
RUN apt-get update && apt-get install -y --no-install-recommends mesa-vulkan-drivers \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci

FROM node-deps AS browser
COPY containers ./containers
COPY tests ./tests
COPY map ./map

FROM browser AS visual-browser
RUN apt-get update && apt-get install -y --no-install-recommends \
    novnc websockify x11vnc xvfb \
    && rm -rf /var/lib/apt/lists/*

FROM node-deps AS web-build
COPY apps ./apps
COPY map ./map
RUN npx vite build apps/web

FROM nginx:stable-alpine@sha256:ef8676b33d681f272ba429b27658bdd7e640963279714c96bddf1dc76307f7b6 AS web
COPY containers/nginx.conf /etc/nginx/nginx.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html
ARG TH_RELEASE_SOURCE
ARG TH_RELEASE_REVISION
ARG TH_RELEASE_VERSION
ARG TH_RELEASE_CREATED
LABEL org.opencontainers.image.source=$TH_RELEASE_SOURCE \
      org.opencontainers.image.revision=$TH_RELEASE_REVISION \
      org.opencontainers.image.version=$TH_RELEASE_VERSION \
      org.opencontainers.image.created=$TH_RELEASE_CREATED \
      org.opencontainers.image.title="Temporal Heist Web"
USER 101:101
ENTRYPOINT ["nginx", "-g", "daemon off;"]
