# Temporal Heist vertical slice

## Objective

Implement a verified two-player browser vertical slice of Temporal Heist using a Rust authoritative server, MoQ as the realtime application data plane, and raw WebGPU for rendering.

Each human player has one authoritative Echo that represents that same player's committed canonical state exactly 10 seconds earlier. The Echo follows the historical trajectory even when current collision geometry would block it. Echo `Presence` and approved Echo `Action` effects apply to the current authoritative world.

The implementation must reach the end-to-end acceptance scene described below without weakening the architecture invariants in `.agentic/PROJECT.md`.

## Product baseline

- View: top-down 2.5D. The world renders in 3D, while MVP gameplay movement is effectively planar.
- Players: exactly two for the vertical slice.
- Echo delay: 600 authority ticks at 60 Hz (10 seconds).
- Echo generations: one.
- Session length target: 5–10 minutes.
- Map target: one tiny facility with three logical rooms/zones.
- Rendering: raw WebGPU/WGSL, primitive/procedural geometry is sufficient.
- Authority: Rust.
- Browser target: desktop Chromium first.
- Authentication/persistence: none for MVP.

## P0 gameplay

### Player

A human player can:

- join one local/dev room;
- move on the gameplay plane;
- be blocked by static walls and currently closed doors;
- activate a pressure plate by presence;
- issue an interaction intent against an interactable target;
- see the other live player;
- see each player's Echo after enough history exists.

Movement may use simple kinematic circle/capsule-vs-AABB collision. A general rigid-body engine is not required.

### Echo

For each connected player with at least 600 committed history ticks:

- `echo_tick = current_tick - 600`;
- the authority obtains the Echo gameplay pose from its committed 60 Hz history;
- the Echo is not resolved against current collision;
- the Echo cannot push, carry, collect, extract, unlock, or otherwise act as a physical player;
- the Echo may contribute to `Presence` interactables using its historical pose in the current world;
- an action accepted from the human at tick `T` may emit an Echo Action pulse at tick `T + 600` if the target is Echo-Action-capable;
- Echo-generated effects must not be appended to the human source timeline.

Before 600 ticks of history exist, that player's Echo simply does not exist.

### Echo interactions

Each interactable declares one capability:

- `None`: Echo has no gameplay effect.
- `Presence`: overlap by an eligible live player or Echo contributes presence.
- `Action`: an authority-approved human action is replayed exactly 600 ticks later as an Echo pulse to the same stable target ID.

For MVP, use explicit target commands such as `activate`, `open-request`, or `pulse`. Do not model Echo interactions as a generic `toggle()` operation.

Echo Action replay does not rerun pathfinding/collision/proximity checks that were part of the original human acceptance. The original action was already authoritative. At replay time the stable target must still exist and permit Echo Action; the target's current-world state machine then consumes the pulse. The static MVP map should make missing targets impossible in normal play.

## Vertical-slice facility

The exact art/layout is reversible. The mechanics are not.

Provide three logical zones:

1. **Live presence tutorial** — a live player stands on a plate and opens a door, proving baseline authority and door collision.
2. **Echo presence room** — a player records occupying a plate, leaves, waits for the delayed Echo, and the Echo opens a door while the live player is elsewhere.
3. **Co-op proof room** — Player A's delayed Echo holds or activates a mechanism while Player B crosses the authority-controlled door/gate. This is the mandatory two-player acceptance scene.

An Echo Action button/terminal may be included in zone 3 if it fits the implementation naturally, but Echo Presence alone is sufficient to satisfy P0. At least one automated simulation test must still cover Echo Action semantics even if the visual slice only requires Presence.

Static cameras/guards, stealth detection, gadgets, inventory, and extraction scoring are post-P0. Do not block the core slice on them.

## Authority simulation requirements

- Fixed logical tick: 60 Hz.
- Authority simulation logic must be testable without network or graphics.
- Keep at least 60 seconds of committed 60 Hz player history in memory for the room.
- Player history stores enough data to reconstruct Echo gameplay pose and accepted Echo-capable actions.
- Inputs arriving from a browser are intents, not state assignments.
- The server validates and commits movement/actions, then publishes canonical replication data.
- Stable entity/target identifiers must survive for the room lifetime.
- Door openness and collision are authority state.
- Pressure plate state is derived each tick from eligible current actors and historical Echo actors.

Prefer a simulation interface close to a deterministic `step(world, inputs) -> tick_result` core. The exact ECS/data structure is an implementation detail.

## Replication and MoQ requirements

Use `moq-dev/moq` through adapters. The vertical slice must exercise the real MoQ relay path.

Conceptual application channels:

- per-player input publication from browser to authority;
- authoritative player timeline replication from authority to browsers;
- authoritative world-state/events replication;
- room/system lifecycle information.

Use application names comparable to:

- authority broadcast: `th/room/{room_id}/authority`;
- input broadcast: `th/room/{room_id}/input/{player_id}`;
- authority tracks: `timeline/{player_id}`, `world`, `system`;
- input tracks: `motion`, `actions`.

These names are an application convention, not a requirement to expose MoQ types inside the domain model.

Do not assume a particular unreliable/datagram API until verified against the installed MoQ version. It is acceptable to bootstrap P0 with the simplest supported reliable/group transport, provided the adapter exposes semantic delivery needs and the code does not prevent later motion-loss optimization.

Published visual timelines should target roughly 20 Hz snapshots, while inputs may target roughly 30 Hz. These are tuning defaults, not authority tick rates. Discrete accepted actions must not be lost merely because visual pose sampling is lower frequency.

Timeline history transferred over the network must be chunked/grouped so an independently fetched group can be decoded without an unbounded earlier delta chain. Full snapshots are preferred initially over premature compression.

## Client requirements

- TypeScript browser application.
- Minimal HTML/CSS UI is sufficient.
- WebGPU feature detection with a clear unsupported-browser message.
- Render primitive world geometry, both live players, doors/plates, and translucent/distinct Echoes.
- Keep a client timeline ring buffer for received canonical samples.
- Visual Echo sampling uses the canonical timeline at `render_time - 10s`, interpolated for presentation.
- Visual interpolation must not feed back into gameplay.
- Keep MoQ imports under a networking adapter/module, separate from game/timeline/render modules.

### WebGPU P0

Raw WebGPU is a hard requirement.

The minimum acceptable WebGPU path is:

- initialize adapter/device/context;
- render the 2.5D world and actors;
- represent Echoes distinctly.

A compute pass for Echo interpolation/trails is strongly preferred and should be implemented if it does not jeopardize the first end-to-end slice. The architecture must permit timeline samples to be uploaded to GPU storage and sampled there later; gameplay must never depend on that compute result.

## Protocol requirements

Use a versioned application protocol. Protocol Buffers are the default source of truth.

Canonical time uses:

- `room_epoch`: changes whenever a room simulation is freshly created/reset;
- `server_tick`: monotonically increments within that epoch.

Prefer integer simulation/network coordinates for authoritative messages (for example millimetres and milliradians) rather than making browser floating-point values the canonical representation.

At minimum represent:

- player identity/session identity;
- input sequence numbers;
- movement intent;
- interaction intent with stable target ID;
- canonical pose/state samples;
- accepted actions and their acceptance tick;
- world states needed to render doors/plates;
- epoch/tick;
- protocol version or compatibility marker.

See `docs/PROTOCOL.md` for the normative semantic model. Exact protobuf field numbers and generator choice may be finalized during bootstrap.

## Required spikes before broad implementation

Perform small, verified spikes early and record conclusions in `STATE.md`/`DECISIONS.md`:

1. Browser `@moq/net` can connect through local `moq-relay`, publish a small binary payload, and receive a payload.
2. Rust `moq-net` can participate in the same local topology needed by the authority process.
3. The current selected MoQ versions provide a workable way to retain/fetch enough recent grouped history for reconnect/late join, or a clearly bounded application-side fallback is documented.
4. Chromium WebGPU initializes under the selected Vite/dev setup and renders a primitive.
5. The chosen protobuf toolchain generates/consumes equivalent Rust and TypeScript messages.

Do not turn a spike into a parallel production architecture. Keep it minimal, then integrate through the intended adapters.

## Acceptance criteria

### A. Deterministic simulation

Automated tests prove:

- a human is blocked by a closed door;
- an Echo trajectory is not blocked or redirected by that same current closed door;
- a live actor can activate a `Presence` plate;
- at tick `T + 600`, the Echo of a player who occupied that plate at tick `T` contributes presence and opens the linked door;
- accepted Echo-capable Action at `T` emits exactly one Echo Action pulse at `T + 600`;
- Echo effects do not recursively create future Echo effects;
- an Echo cannot affect `None` targets.

### B. Protocol/replication

Automated tests prove:

- Rust/TypeScript protocol round-trip compatibility for representative messages;
- stale/wrong room epochs are rejected or safely ignored;
- duplicate input/action sequence numbers do not cause duplicate authority effects;
- timeline groups/snapshots can be decoded from their documented independent boundary.

### C. Local network integration

A repeatable local command or documented command set starts:

- one `moq-relay`;
- one Rust authority process;
- the browser dev server.

Two browser clients can join the same room and receive each other's canonical state through the relay/authority path.

### D. End-to-end game scene

With two Chromium clients:

1. Player A records standing on the designated pressure plate.
2. A leaves the plate.
3. Exactly 10 seconds of authority time later, A's Echo reaches/occupies that historical plate position.
4. The authority opens the linked current-world door because of Echo presence.
5. Player B crosses the now-open door.
6. Both clients render a consistent result with WebGPU.

Capture enough automated or reproducible evidence that a later agent can determine whether this scenario still works.

### E. Quality gates

- No direct `@moq/net`/`moq-net` imports in gameplay/domain modules.
- No renderer-derived authoritative state.
- Relevant format/lint/typecheck/unit/integration checks pass.
- Durable commands discovered during bootstrap are written to `.agentic/PROJECT.md`.
- `STATE.md` records verification evidence and remaining limitations.

## Explicit non-goals for P0

- production authentication/authorization;
- persistent accounts or world state;
- matchmaking;
- WAN deployment or relay clustering;
- voice/video chat;
- mobile/touch support;
- Safari/Firefox parity;
- guard AI or full stealth scoring;
- inventory/loot/gadgets;
- multiple Echo generations;
- Echo physical pushing/carrying;
- rewind of world state;
- polished art/audio;
- bandwidth optimization beyond what is needed to keep architecture sane.

## Engineering autonomy

Codex should decide reversible implementation choices without asking the user, including package manager, protobuf generator, test framework, module naming, worktree/subagent use, and PR topology.

Ask for product input only if a proposed change would alter the committed Echo semantics, authority boundary, P0 acceptance scene, raw-WebGPU requirement, or use of MoQ as the actual data plane.

## Definition of done

The task is done when all P0 acceptance criteria are implemented and verified, the local two-browser scene is reproducible, and repository task state contains enough evidence and commands for another Codex session to continue without rediscovery.
