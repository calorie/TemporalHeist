# Application protocol semantics

This document defines application-level semantics independent of the exact current `moq-dev/moq` API.

MoQ transport framing is an adapter concern. Protocol Buffers are the payload
schema. `proto/temporal_heist.proto` is the source of truth; Rust bindings
generate during Cargo build and TypeScript bindings through
`containers/codegen.sh`.

## Versioning

Every session must have a protocol compatibility mechanism.

At minimum identify:

- application protocol major version;
- room epoch;
- player/session identity where relevant.

Incompatible major versions fail clearly rather than attempting silent partial decoding.

## Canonical time

Canonical timestamps are not wall-clock timestamps.

~~~text
RoomTime {
  room_epoch
  server_tick
}
~~~

`server_tick` increments exactly once per logical authority simulation step.

Current constants:

- tick rate: 60 Hz;
- Echo delay: 600 ticks;
- authority retained history: at least 3601 ticks (60 seconds plus one sample).

## Numeric representation

Prefer integer authoritative wire units:

- position: millimetres (`x_mm`, `z_mm`);
- yaw: milliradians or another documented integer angular unit;
- normalized movement axes: signed quantized integers.

Rendering converts these to floating-point GPU units.

This avoids making JavaScript/browser floating-point state itself the canonical simulation representation. The internal Rust simulation may use fixed-point/integer or carefully controlled floats as long as authority is singular and deterministic tests cover required behavior.

## Stable identifiers

Use stable IDs within one room epoch for:

- player;
- player session if reconnect distinction is needed;
- world entity;
- interactable target.

Echo identity is derived from source player + generation and does not require a separate independently mutable player identity.

## Input messages

`Input` carries protocol major, room epoch, player/session identity, monotonic
sequence, movement axes, kind, and action target in one message. The authority
validates these fields and deduplicates by sequence.

### MotionIntent

Semantic fields:

~~~text
protocol_major
room_epoch
player_id/session_id
client_sequence
move_x_quantized
move_z_quantized
facing_quantized (optional if derived)
client_observed_server_tick (optional diagnostic/prediction aid)
~~~

Properties:

- sequence is monotonic per player session;
- authority may hold the latest motion until a newer motion arrives;
- stale motion never rewinds canonical state;
- receiving the same sequence twice is idempotent.

### ActionIntent

Semantic fields:

~~~text
protocol_major
room_epoch
player_id/session_id
action_sequence
kind
target_id
optional action parameters
client_observed_server_tick
~~~

Properties:

- authority validates the human action against current human state;
- duplicate `action_sequence` values never produce duplicate accepted actions;
- accepted actions receive an authoritative acceptance tick;
- only accepted actions may later produce Echo Actions.

## Canonical timeline

The authority's internal source history is 60 Hz. The published visual timeline may be lower rate.

### PlayerTimelineSample

Semantic fields:

~~~text
protocol_major
room_epoch
server_tick
player_id
pose { x_mm, z_mm, yaw_quantized }
stance/animation hint
optional velocity/presentation hint
accepted_actions[]
~~~

`accepted_actions` may instead live on a dedicated event stream if that produces a cleaner implementation, but action delivery must be canonical and loss-safe.

### AppliedAction

Semantic fields:

~~~text
action_sequence or authority_action_id
source_player_id
acceptance_tick
kind
target_id
echo_capable
~~~

Human acceptance is the source event. Echo replay derives from it; Echo replay itself is not another source `AppliedAction` for future generations.

## World replication

### WorldSnapshot / WorldDelta

P0 world data needed by browsers includes:

- current authority tick;
- door IDs and open/closed state;
- pressure plate IDs and active/inactive state;
- optional interactable/debug state needed to understand the slice.

Start with independently decodable snapshots if deltas would complicate recovery. Optimize later.

P2 adds `Snapshot.guards` as repeated field 12. Each `Guard` contains stable ID,
integer X/Z position and facing, `GuardState`, next waypoint ID, optional
`GuardTarget`, state-entry tick, and search-expiry tick. `GuardState` values are
Unspecified 0, Patrol 1, Investigate 2, and Return 3. The optional target remains
present at coordinate zero and is absent outside investigation. The guard pose
and timers come from the authority; client interpolation affects display only.

`RoomState.failure_guard_id` is field 11. `FailureReason.GUARD` is value 3, next
to TIMEOUT 1 and SURVEILLANCE 2. A guard failure publishes reason and guard ID;
the frozen P2 wire contract does not include a detected-player ID for guards.
Older snapshots without field 12 decode to an empty guard list. Unknown guard
states use a safe browser presentation fallback. These fields are additive under
protocol major 1; cross-language tests cover Rust-to-TypeScript guard states,
optional target presence, guard failure, and the absent-field case.

P3 adds `RoomState.objective_secured` as boolean field 12 under protocol major 1.
An omitted field decodes as `false`, preserving legacy room messages. The map
authors objective target ID 61 at `(21000, 4000)` with radius 750 mm. A live
connected human can address it with the existing `ACTION` and `target_id` input;
Echo Action cannot secure it. A valid live-human action sets the authoritative
room state for the attempt, including after that player disconnects. Victory
requires it, and restart resets it to `false`.

## System/lifecycle messages

Useful semantics include:

- room ready/epoch announcement;
- player roster/join/leave;
- assigned player ID/session ID;
- current authority tick;
- history/bootstrap boundary;
- protocol incompatibility/error;
- server diagnostics safe for development UI.

## Echo derivation

Echo pose is not sent from a client.

At authority tick `N`:

~~~text
if history contains source tick N - 600:
    echo_pose = committed human pose at N - 600
    evaluate Presence using echo_pose in current world

if accepted Echo-capable actions exist at N - 600:
    for each such action:
        deliver one Echo Action pulse to same stable target in current world
~~~

Current collision is not queried to alter `echo_pose`.

## Echo Action idempotency

A network retry/reorder must not cause multiple Echo pulses.

Derive a stable Echo-event key such as:

~~~text
(room_epoch, source_player_id, authority_action_id, echo_generation)
~~~

or another equivalent unique identity.

Tests must prove exactly-once authority effect under duplicate input delivery.

## Application transport mapping

Conceptual broadcasts/tracks:

~~~text
th/room/{room_id}/input/{player_id}
  motion
  actions

th/room/{room_id}/authority
  timeline/{player_id}
  world
  system
~~~

Mapping rules:

- motion is timeliness-oriented; newer state supersedes older state;
- actions are reliability/idempotency-oriented;
- canonical timeline is ordered by authority time;
- world/system data must permit late/recovering consumers to regain a coherent current state;
- historical groups intended for fetch/bootstrap are independently decodable.

Do not bake transport-library object types into protobuf messages.

## Grouping/history

Initial target: approximately one second of published timeline data per independently decodable group/chunk.

At roughly 20 Hz pose publication, a group contains about 20 samples per player.

A group's first usable payload must provide enough absolute state to decode that group without prior groups. Full samples for all P0 frames are acceptable and preferred over delta compression.

For a late joiner, the desired adapter behavior is:

1. receive/establish current room epoch and current authoritative state;
2. acquire enough recent canonical timeline to display the 10-second Echo immediately when possible;
3. begin/continue live subscription without duplicating semantic events;
4. fill a local presentation ring buffer.

Use the current MoQ library's supported history/fetch mechanism if verified. If the API cannot provide the exact range conveniently, implement a bounded authority-origin bootstrap over MoQ rather than changing the gameplay protocol.

## Ordering assumptions

Do not require global total ordering across all tracks unless the selected MoQ API guarantees it and it is genuinely needed.

Use `(room_epoch, server_tick)` and stable event IDs to reconcile semantic ordering.

For rendering, timeline samples can be locally sorted/buffered by server tick.

For actions, authority acceptance order is canonical.

## Reconnect

On reconnect:

- client obtains current room epoch;
- if epoch changed, discard all prior room/timeline state;
- if epoch is unchanged, discard/merge stale samples by tick/event identity;
- action intents must not be blindly replayed unless their idempotent sequence identity is preserved.

## Validation limits

Authority must reject or clamp malformed input:

- unknown player/session;
- wrong epoch;
- impossible/invalid enum values;
- invalid target;
- out-of-range movement axes;
- duplicated/stale sequences;
- payloads over reasonable size limits.

The relay is not trusted to enforce game semantics.

## Protobuf bootstrap guidance

During implementation, create a small schema before broad game code. Prefer messages that mirror semantic boundaries rather than mirroring Rust structs.

Required cross-language verification:

- TypeScript encode → Rust decode;
- Rust encode → TypeScript decode;
- representative golden vectors committed only if they materially improve regression coverage.

Keep generated outputs reproducible and document the generation/check command in `.agentic/PROJECT.md`.

## Compatibility evolution

The implementation remains on major version 1, including P2's additive guard
fields.

Future-compatible rules:

- reserve removed field numbers/names;
- add optional fields compatibly where practical;
- bump major version when semantics become incompatible;
- never infer Echo timing from protocol arrival time; always use authority tick.
