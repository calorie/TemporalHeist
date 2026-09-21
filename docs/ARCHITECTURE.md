# Architecture

## System overview

~~~text
Browser A                        Browser B
   |                                |
   | publish input intents          | publish input intents
   v                                v
               moq-relay
                    |
                    v
            Rust authority
             60 Hz room sim
                    |
                    | publish canonical timelines/world
                    v
               moq-relay
              /             \
             v               v
        Browser A         Browser B
        WebGPU render     WebGPU render
~~~

`moq-relay` is transport infrastructure. It must not contain game business logic.

The authority is the single gameplay source of truth.

## Intended repository shape

This is a target shape, not a mandate to create empty scaffolding before it is useful:

~~~text
apps/
  web/
    src/
      game/
      timeline/
      render/
      net/moq/

crates/
  sim/
  protocol/
  authority/

proto/
  temporal_heist.proto

docs/
~~~

The exact workspace boundaries may change if simpler verified boundaries emerge. Preserve separation of pure simulation, protocol, authority integration, browser rendering, and MoQ adapters.

## Authority

### Responsibilities

- own room lifecycle and canonical clock;
- validate/deduplicate browser intents;
- run fixed 60 Hz game simulation;
- resolve current human collision;
- commit player histories;
- evaluate Echo poses/effects;
- own doors, plates, and interactable state;
- publish canonical state/timelines;
- retain enough in-memory history for P0;
- expose diagnostics useful for tests.

### Non-responsibilities

- visual interpolation;
- WebGPU rendering;
- trusting client position as canonical;
- relying on relay cache for gameplay correctness.

## Pure simulation

`sim` should be runnable without MoQ, sockets, browser APIs, or GPU.

Prefer deterministic data flow conceptually like:

~~~text
inputs for tick N
      |
      v
validate/normalize
      |
      v
step current humans + world
      |
      v
commit human history N
      |
      v
sample historical tick N-600
      |
      v
evaluate Echo Presence / due Echo Actions
      |
      v
derive doors/plates and tick result
~~~

Ordering must be explicit and tested. If implementation uses a different order, document it and ensure the resulting semantics match the acceptance tests.

## History model

Keep at least 60 seconds of committed human history per room/player.

The gameplay history is 60 Hz because Echo effects need exact authority-tick semantics. A compact ring buffer is sufficient for P0.

Suggested stored data per committed tick:

- canonical pose/stance needed for Presence;
- source player identity;
- accepted Echo-capable actions at that tick or references into an action log.

Network replication does not need to publish all 60 ticks per second.

## Client prediction

Prediction is optional for the first working path.

If implemented:

- local movement may predict against a client copy of static collision;
- authority snapshots reconcile the client;
- prediction errors may alter presentation only;
- no predicted interaction is considered committed until authority acceptance.

Top-down movement makes a short initial phase with minimal/no prediction acceptable if it accelerates verified vertical-slice delivery.

## MoQ adapter boundary

Domain/application code should speak semantic interfaces such as:

~~~text
InputSink.publish_motion(intent)
InputSink.publish_action(intent)
RoomFeed.on_player_sample(...)
RoomFeed.on_world_update(...)
RoomFeed.on_system_event(...)
HistorySource.fetch_recent(...)
~~~

These are conceptual names. Do not force them if another smaller interface is clearer.

Only adapter modules should know `@moq/net`/`moq-net` APIs, broadcast/track objects, transport negotiation, reconnect mechanics, or relay URLs.

This boundary exists because both `moq-dev/moq` and IETF MOQT evolve quickly.

## MoQ topology

Application-level naming convention:

~~~text
th/room/{room_id}/input/{player_id}
  motion
  actions

th/room/{room_id}/authority
  timeline/{player_id}
  world
  system
~~~

The exact mapping to current MoQ broadcast/track/group/frame APIs must be verified by the initial transport spike.

Motion is semantically latest-value/timeliness-oriented. Actions are semantically reliable/deduplicated. P0 may use a reliable transport for both if that is the smallest verified path; keep the semantics separate so later partial-reliability tuning is localized.

## Relay and history

Gameplay correctness cannot depend on a CDN/relay retaining an arbitrary amount of history.

The authority always owns the recent gameplay ring buffer.

For late join/reconnect, prefer current MoQ grouped-history/fetch capabilities when verified. If the selected library/version cannot provide the needed bounded history cleanly, the authority adapter may republish a bounded bootstrap snapshot/history through MoQ. Do not introduce a second application WebSocket control plane merely to avoid investigating the MoQ path.

## Protocol boundary

Protocol Buffers define cross-language application messages once bootstrapped.

Generated Rust and TypeScript types live outside the domain model if they make the domain depend on serialization details. Convert at boundaries when useful.

Use schema/version compatibility checks and golden/round-trip tests across languages.

## Browser modules

### Game/timeline

- consume canonical network messages;
- maintain presentation state/timeline ring;
- produce render-friendly state;
- optionally implement prediction/reconciliation.

### Renderer

- owns WebGPU adapter/device/context;
- creates primitive world/actor geometry;
- draws world, live actors, and Echoes;
- may upload timeline samples to storage buffers;
- may use compute to derive Echo transforms/trails;
- never emits authority state.

### UI

HTML/CSS overlay is acceptable for:

- room/player status;
- connection state;
- Echo warm-up/countdown;
- debug tick/network information.

## WebGPU pipeline direction

Minimal P0:

~~~text
canonical samples
      |
      v
CPU presentation/timeline buffers
      |
      v
GPU vertex/uniform/storage buffers
      |
      v
opaque world/actor render
      |
      v
Echo render
~~~

Preferred evolution:

~~~text
timeline storage buffer
      |
      v
compute: sample/interpolate T-delay + trail samples
      |
      v
instance/indirect data
      |
      v
Echo render pass
~~~

The first path may interpolate on CPU if needed to prove end-to-end gameplay, but raw WebGPU rendering is mandatory. Add compute once the network/simulation path is stable.

## Room clock

Authority owns:

~~~text
room_epoch: opaque/random or monotonic room-instance identifier
server_tick: u64-like monotonic tick within the epoch
tick_rate: fixed 60 Hz
echo_delay_ticks: fixed 600 for P0
~~~

Never use `Date.now()`/browser timezone as canonical game time.

Client estimates presentation time relative to received authority samples but identifies canonical events by epoch/tick.

## Development and agent execution topology

Containerization is mandatory for every project process. The host is only an orchestration surface for Git, Codex/agent tooling, and the container runtime.

A normal per-agent stack is conceptually:

~~~text
agent A worktree                    agent B worktree
       |                                   |
compose project: th-a              compose project: th-b
       |                                   |
+------+------------------+         +------+------------------+
| isolated container net  |         | isolated container net  |
|                         |         |                         |
| dev/build/test tools    |         | dev/build/test tools    |
| moq-relay A             |         | moq-relay B             |
| authority A             |         | authority B             |
| web A                   |         | web B                   |
| Chromium/E2E A          |         | Chromium/E2E B          |
| private writable vols   |         | private writable vols   |
+-------------------------+         +-------------------------+
~~~

No application process is shared between these stacks.

### Host boundary

Project correctness must never depend on host-installed language runtimes or browsers. Do not run project `cargo`, Node/Bun/npm/pnpm, protobuf generators, Vite, MoQ binaries, Chromium, Playwright, or test tools directly on the host.

Repository helper commands may execute on the host only as thin wrappers around the container runtime/orchestrator.

### Per-agent namespacing

Every writing agent receives:

- an isolated Git worktree/checkout;
- a unique agent/run identifier;
- a unique Compose/project namespace;
- an isolated container network;
- independently writable named volumes/caches;
- its own relay and authority process;
- its own generated certificates/test credentials;
- isolated test artifacts, logs, screenshots, and browser profiles.

Avoid `container_name`. Avoid globally named networks/volumes. Automated tests must not depend on fixed host ports; prefer container-network DNS and ephemeral/published-on-demand ports.

A single teardown command for agent A must be unable to stop or delete agent B resources.

### Parallel implementation boundary

The architecture should maximize implementation parallelism, but shared contracts remain a deliberate synchronization boundary.

The first bootstrap wave should establish the minimum viable shared contracts:

- repository/container entry points;
- protobuf/application protocol baseline;
- semantic client/server transport interfaces;
- stable simulation-facing data contracts.

Once those are frozen/versioned, independent implementation agents can work concurrently on disjoint ownership such as simulation, authority/MoQ, browser/MoQ, WebGPU, and integration/E2E.

No component may require another agent's live container or unpublished filesystem output. Generated files must be reproducible from checked-in sources of truth inside each agent's own container.

If a shared contract must change, serialize that change, update/regenerate affected consumers in containers, verify compatibility, then resume the parallel wave.

### Containerized test topology

Provide containerized layers so an agent can run the narrowest useful check without starting unrelated services:

1. **component** — Rust sim/unit tests; TypeScript unit/type tests; shader/static checks;
2. **protocol** — protobuf generation and Rust↔TypeScript compatibility;
3. **transport** — browser/Rust MoQ adapter integration against a private relay;
4. **stack** — private relay + authority + web;
5. **E2E** — two containerized Chromium clients against that private stack;
6. **WebGPU** — Chromium WebGPU smoke/render checks inside the browser container.

WebGPU may use a verified software Vulkan/GPU implementation for CI/agents, or explicit device passthrough when available. In either case the browser process remains containerized.

The isolation acceptance test is to run two independently namespaced integration/full-stack test invocations concurrently on the same host and show no port, network, volume, certificate, profile, or service-name collisions.

### Interactive visual verification

If a human needs to inspect the running game, keep Chromium in the container and expose an appropriate remote display/debugging surface. Opening the application in a host-native browser is not the normative run/test path.

### CI parity

CI must call the same containerized entry points used by local agents. CI should not duplicate the project toolchain as a separate host-native workflow.

## Observability

At minimum expose structured/loggable values for:

- room epoch/tick;
- player join/leave;
- input sequence/dedup rejection;
- accepted action and target;
- scheduled/fired Echo Action;
- Echo warm-up/activation;
- relay connection/reconnect;
- protocol decode failure.

Do not log every 60 Hz pose at normal verbosity.

## Failure handling

- Wrong epoch: reject/ignore message safely.
- Stale input sequence: ignore.
- Duplicate action sequence: deduplicate.
- Network gap: keep authority sim running; clients reconcile from newer canonical data.
- Client disconnect: remove/disable live actor according to deterministic room policy.
- WebGPU unavailable: show unsupported message; do not silently swap to a different rendering engine for P0.
- Relay loss: surface connection status and reconnect at adapter boundary; do not mutate gameplay from guessed client state.

## Future scaling

The P0 architecture should not promise MMO scale. It should preserve useful properties for later expansion:

- room-scoped broadcast naming;
- clean authority/relay separation;
- bounded historical groups;
- semantic motion/action priority separation;
- deterministic simulation tests;
- optional spectator/history consumers that subscribe without becoming authority.
