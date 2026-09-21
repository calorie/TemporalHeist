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

## Development topology

Local development must make it straightforward to run:

1. `moq-relay`;
2. Rust authority;
3. browser dev server;
4. two browser tabs/windows.

Containerization is optional. Prefer the smallest reproducible local loop first.

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
