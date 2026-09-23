# Frozen contract v1

Frozen after containerized protocol, WebGPU, bidirectional MoQ, retained-group,
two-client, and two-independent-stack spikes passed on 2026-09-22. Component
work may rely on this contract. A change to this file, the protobuf schema, map
source, or container command contract is serialized and requires compatibility
verification before dependent work resumes.

Protocol source: `proto/temporal_heist.proto`. Protocol major 1; tick rate 60;
Echo delay 600; authority history capacity 3601 samples per player. Integer
coordinates are millimetres. Input axes range from -1000 through 1000.

Input sequence watermarks are separate for JOIN/MOTION/ACTION/LEAVE/READY/RESTART
per session.
JOIN claims player slot 1 or 2 with a random session ID, and must carry the current
epoch received from the authority. Slots owned by a different live session reject
the claim. Snapshots acknowledge ownership through `sessions`. Wrong versions,
epochs, invalid IDs, unspecified/unknown kinds, malformed axes and oversized
payloads are rejected. Motion times out to zero after 30 ticks without refresh;
session expires after 300 ticks without accepted input. Reconnect can reuse a
session with preserved sequence counters; a new epoch clears client state. A
disconnect removes the live actor and its Echo immediately while retaining its
history internally. A new session does not inherit that Echo. Already accepted
Echo-capable actions remain scheduled and fire once even if the source disconnects.
Rejected Action sequences consume their watermark so retrying one later cannot
turn it into a newly accepted action. A same-session JOIN refresh does not reset
history or sequence counters.

Snapshots contain current players, authoritative echoes, doors/plates, session
acknowledgements and a bounded accepted-action log (at least 3600 ticks), including
Echo pulses flagged separately. Echo pulses never enter canonical human history.
Every snapshot is independently decodable. The timeline chunk carries absolute
snapshots and epoch. Authority publishes snapshots every 3 ticks, input at ~30 Hz.
An authority-origin bootstrap chunk carries the recent 660 ticks at network rate
over MoQ, allowing immediate visual Echo sampling on late join/reconnect.

Application transport exposes bytes to authority and decoded protocol values to
the browser controller; MoQ types remain inside `net/moq` modules. Broadcasts:
`th/room/<room>/authority` (world, history) and `th/room/<room>/input/<1|2>`
(motion, actions). Reliable groups are used for all P0 data. Each frame is absolute.

The map source will be a checked-in JSON specification shared by simulation and
renderer. It contains floor bounds, walls, plates and corresponding doors, stable
IDs, action terminals, player spawn positions, and the P1 extraction rectangle.
Three zones run along X.

P2's serialized final-review map correction adds walls 107 and 108 at
X `18100..18500`, spanning Z `0..3300` and `4700..8000` respectively. The
`guardedPassage` rectangle is their opening, X `18100..18500`, Z `3300..4700`.
Live collision and rendering consume those same walls; passage metadata alone
does not impose collision. Guard 51 starts at waypoint 511 `(19100,4000)` and
patrols to waypoint 512 `(20500,4000)` while retaining its configured westward
watch facing `(-1000,0)`. Investigate and Return face their movement targets;
rejoining Patrol restores the watch facing before detection and publication.
The entire reachable west-entry slab stays in view throughout Patrol, so it
cannot be crossed by following behind the guard without an Echo diversion.
The 140-tick route period avoids synchronizing with the exact 600-tick Echo.
Plate 23, door 13, and extraction keep their coordinates; all IDs remain stable.
Guard perception uses
integer angular comparisons clipped by a 2600 mm radial range; the raw WebGPU
cone clips the same radial boundary without feeding results into gameplay.

P1 extends protocol major 1 additively with READY and RESTART input kinds,
`Session.ready`, `Snapshot.room`, and `Snapshot.hazards`. Room state carries LOBBY, ACTIVE, WON, or
FAILED plus attempt identity, authority-tick timing, readiness, extraction
occupancy, and whether Echo Presence opened the final door in the current attempt.
Older decoders may ignore these additions.

The authority starts an attempt only while both player sessions are connected and
ready. It records the start and five-minute deadline as server ticks. A win
requires both live players inside extraction after Echo Presence has opened door
13 during the same attempt. Deadline expiry produces failure. A restart accepted
in a terminal phase returns the room to lobby, respawns connected players, clears
readiness, history, scheduled actions, and mechanism state, and increments the
attempt number.

P1.2 adds static surveillance cameras to the map source. Each camera has a stable
ID, origin, normalized integer direction (length 1000), range, and half-width at
maximum range. The authority evaluates a triangular cone using integer math every
ACTIVE tick. A live player's center inside the cone immediately fails the attempt
with `SURVEILLANCE`, the camera ID, and detected player ID. Echoes never trigger
surveillance. Camera state is reset with the attempt; TIMEOUT remains a distinct
failure reason.

Pure simulation API: `World::new(epoch: String)`, `World::step(inputs: &[Input])
-> Snapshot`, `World::snapshot() -> Snapshot`. `World` stores its history privately.
The sim may depend on generated protocol DTOs but never MoQ/network/GPU crates.
Tests can set up fixtures through public map/world configuration helpers without
adding production teleport inputs. Authority owns the 60 Hz scheduling loop.

Browser renderer accepts only presentation data: current snapshot, interpolated
live poses, interpolated historical Echo poses, map geometry. It returns no game
state. Timeline holds a bounded sorted/deduplicated epoch-scoped sample ring and
samples Echo at render tick minus 600. Authoritative Echo poses are diagnostics,
not the substitute for client historical visual sampling.

Container command baseline: `sh container <unique-agent-run-id> <compose args>`.
Every invocation derives project `th-<id>`. No fixed host ports, container names,
external volumes/networks or writable caches shared between project IDs. Each
writing worktree requires a unique ID. All app/toolchain execution is in services.
