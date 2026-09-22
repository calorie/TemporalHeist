# Initial two-stack transport isolation spike

Each checkout uses a distinct agent/run ID and its own Compose volumes, network,
certificates, web server, native authority, relay and two containerized Chromium
clients. No host ports are published.

The relay image is an immutable tool artifact; build it once with
`docker build -f containers/Relay.Dockerfile -t temporal-heist-relay:0.14.18 .`.
No runtime storage is shared by using this image.

In each checkout, substituting a unique ID:

```sh
sh container isolation-0922 build dev
sh container isolation-0922 run --rm dev sh -lc 'npm ci && cargo build --manifest-path spikes/transport/Cargo.toml'
sh container isolation-0922 -f spikes/transport/compose.yaml -f spikes/isolation/compose.yaml up -d relay web
sh container isolation-0922 -f spikes/transport/compose.yaml -f spikes/isolation/compose.yaml up -d authority
sh container isolation-0922 run --rm dev node spikes/isolation/test.mjs
```

Run the final command concurrently in both stacks. The test must report both
browser replies and retained-group fetch over WebTransport/moq-lite-05. It keeps
both independent browser processes connected for 45 seconds after success
(`TH_HOLD_MS` can override this), allowing concurrent-stack inspection. Private
profiles, screenshots and timestamped JSON evidence are written under
`/artifacts/isolation-AGENT_RUN_ID/`. Inspect
Compose project labels on containers, networks and volumes with `docker inspect`.
Then tear one stack down completely and rerun the test on the survivor after
restarting its short-lived spike authority:

```sh
sh container isolation-0922 -f spikes/transport/compose.yaml -f spikes/isolation/compose.yaml down --volumes --remove-orphans
```

This is a transport prerequisite, not the final gameplay scene. The final
acceptance must repeat this isolation check with the production authority,
renderer and Echo scene.
