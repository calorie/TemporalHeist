# WebGPU Temporal Bridge design

Each client derives a presentation-only bridge for each player from retained
canonical snapshots. The bridge begins at `renderTick - 600`, which is the Echo's
source pose, and ends at the current human pose. Missing identity or discontinuous
samples never create a synthetic straight-line connection.

Continuity is keyed by `(room_epoch, room.attempt)` and requires ACTIVE samples no
more than three ticks apart. Lobby and restarted-attempt samples never connect.
The spawn ring begins only at an observed authoritative Echo absent-to-present
transition; late history that starts with an Echo present does not synthesize it.

The GPU receives fixed-size segment records and expands each instance into a ribbon.
WGSL applies owner color, age gradient, taper, edge alpha, and one-second knots. A
separate procedural ring is active for canonical ticks 600–659 after attempt start.
Opaque scene geometry renders before the transparent temporal pass, which tests depth
without writing it. Fixed persistent buffers bound CPU/GPU work and avoid per-frame
allocation. Capacity is 512 records: endpoint interpolation can produce 402 segments
for two players at normal 20 Hz cadence. Unexpected overflow is an explicit error.

Pure tests own temporal semantics. A production-renderer Chromium probe owns WGSL,
buffer layout, pixel, adapter, and validation evidence. The full mission reuses an
existing Echo scene to prove two-client canonical agreement without adding a second
long route or image-diff system.
