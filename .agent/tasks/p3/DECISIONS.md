# P3 decisions

## 2026-09-23 — Review topology

Use a four-layer GitHub PR stack: contract/map, authority mission, client
presentation, and full mission E2E. The layers are dependent but independently
reviewable and verifiable. Only the first layer is based on `main`.

## 2026-09-23 — Mission objective

Use one attempt-scoped authority-owned boolean mission fact. A live connected
player secures data by sending the existing targeted action while within the
authored vault terminal radius. Echoes cannot steal. Do not add inventory,
carriers, drops, acquisition attribution, scoring, checkpoints, or a generic loot
collection before the game needs them.

Keep protocol major 1 and add only `RoomState.objective_secured`. Store the vault
terminal's stable ID, position, and radius in the map source of truth. Victory
requires the objective, Echo-opened final door, and both humans in extraction.

## 2026-09-23 — Frozen P3.1 contract values

Use `RoomState.objective_secured` boolean field 12; absent data decodes to
`false`. The authored objective has ID 61, center `(21000, 4000)` mm, and a
750 mm interaction radius. It is distinct from Echo-Action terminals and its
target ID must remain unique among them. The contract layer publishes `false`
until the authority layer implements the attempt state.

## 2026-09-23 — Authority theft transition

Handle objective actions in the existing active-action path after session and
sequence validation. Reuse the simulation's inclusive squared-distance helper
for the authored radius. Keep the theft flag in `World`, publish it in every
snapshot, and clear it on restart. Objective actions never enter the action log
or Echo scheduler, so replay cannot create a theft. Victory gates on theft,
Echo-opened final door, and two humans in extraction.

## 2026-09-23 — Client targeting boundary

Auto-target only selectable items within the authority's interaction ranges:
1,000 mm for existing terminals and the authored 750 mm for the vault objective.
Exclude the vault objective once `snapshot.room.objectiveSecured` is true. With no
candidate, send target 0; the authority still validates every action. Render and
HUD state read the authoritative snapshot, so local presentation cannot claim a
successful theft.

## 2026-09-23 — Full mission acceptance

Keep one existing two-player route and add one live action at objective 61 after
the guarded crossing. Approach from the safe north lane during a west-facing
patrol window and return there before slow software-rendered screenshots. Match
both clients by authority tick and room epoch before recording theft success.
Replace the two redundant guard-crossed screenshots with two secured-terminal
screenshots, preserving the total screenshot count. Check the actual PNG's
terminal color and the post-theft HUD; the post-win restart also checks the cyan
terminal and cleared authority state. Deterministic lower-layer tests retain
Echo-action rejection coverage without adding a browser injection API.

Use `p3-t4-` namespaces for this layer's red, release, and isolation runs. The
release gates run serially; only the dedicated two-stack isolation harness runs
acceptances concurrently, using clean disposable worktrees at one committed
code revision.

The first full route reached shared theft at tick 10170 but failed at tick 10733:
a replayed crossing drew the guard off its route, and the guard's return cone
caught the human on the final plate's north edge. After theft, stage at
`(19500, 1000)` until at least 600 authority ticks after arriving there and until
the guard returns to PATROL. This lets the vault excursion finish replaying
before starting the final plate recording; it preserves the normal authority
and Echo semantics and uses canonical state rather than a wall-clock delay.

The first two-stack run exposed a preexisting decoy-arrival timing assumption:
player A's observed depth skipped the `(3800 ± 180)` arrival band, so `moveTo`
kept correcting until the patrol returned and detected the human. The decoy
only needs a recorded forward excursion. Stop at the first authoritative pose
at or past depth 3620 (the original arrival band's near edge), then retreat.
This monotonic condition preserves the original route and guard phase while
avoiding an unnecessary oscillating settle operation in its short safe window.
