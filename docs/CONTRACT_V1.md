# Draft contract v1 (not frozen until spikes pass)

Protocol source: `proto/temporal_heist.proto`. Protocol major 1; tick rate 60;
Echo delay 600; authority history capacity 3601 samples per player. Integer
coordinates are millimetres. Input axes range from -1000 through 1000.

Input sequence watermarks are separate for JOIN/MOTION/ACTION/LEAVE per session.
JOIN claims player slot 1 or 2 with a random session ID, and must carry the current
epoch received from the authority. Slots owned by a different live session reject
the claim. Snapshots acknowledge ownership through `sessions`. Wrong versions,
epochs, invalid IDs, unspecified/unknown kinds, malformed axes and oversized
payloads are rejected. Motion times out to zero after 30 ticks without refresh;
session expires after 300 ticks without accepted input. Reconnect can reuse a
session with preserved sequence counters; a new epoch clears client state.

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
IDs, action terminals, and player spawn positions. Three zones run along X.

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
