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
