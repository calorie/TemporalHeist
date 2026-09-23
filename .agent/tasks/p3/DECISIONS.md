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
