# P2 decisions

## 2026-09-23 — Guard behavior

Use one authority-owned guard with deterministic Patrol, Investigate, and Return
states. A visible live human fails the attempt. A visible first-generation Echo
records a last-seen target and causes investigation without failure. This makes
the established Echo mechanic a deliberate stealth tool while keeping gameplay
authority and replay semantics unchanged.

Use authored straight-line waypoint segments rather than general pathfinding.
This is sufficient for one readable encounter, keeps integer simulation and E2E
deterministic, and avoids building navigation infrastructure before the game needs
dynamic routes.

Human detection takes priority over Echo investigation on the same tick. Continuous
visibility of one Echo replay segment is deduplicated so it cannot hold the guard
in an indefinitely refreshed state. Restart restores all guard state.

Use a 30-tick Echo observation window keyed by source player and
`source_tick / 30`. A continuous replay segment may update its last-seen position
inside that window but cannot refresh the guard's state-entry or search-expiry tick.
Use an optional protobuf `GuardTarget` message so a valid target on coordinate zero
is distinguishable from the absence of an investigation target.

## 2026-09-23 — Frozen P2 protocol and map identifiers

Keep protocol major 1 and extend it additively. `Snapshot.guards` is field 12,
after the existing fields 1–11. `RoomState.failure_guard_id` is field 11.
`FailureReason.GUARD` is value 3, and `GuardState` assigns Patrol, Investigate,
and Return values 1, 2, and 3 respectively, with value 0 reserved as unspecified.
Legacy snapshots that omit field 12 decode to an empty guard array.

The authored encounter uses guard ID 51 at `(17200, 4000)`, initially facing
positive X, moving 20 mm per tick, with range 2600 mm, half-width 1400 mm, and a
180-tick search. Its cyclic route is explicitly ordered as waypoint 511 at
`(17200, 4000)` followed by waypoint 512 at `(20500, 4000)`. The guarded passage
is the rectangle X `18500..19500`, Z `3000..5000`, which intersects the patrol
route and gives E2E a stable authored crossing target. No navigation mesh is added.

## 2026-09-23 — Simulation implementation

An active tick advances the guard, resolves connected live-human visibility first,
then examines authoritative Echo poses. Search expiry is set once on arrival and
is never extended by continuing Echo visibility. A new Echo can trigger another
investigation after a gap in visibility and a different observation key. Returning
chooses the closest route waypoint by squared integer distance, with route order
breaking ties.

The guard snapshot's waypoint ID is its next patrol or return target. The initial
guard starts at waypoint 511 and targets 512. An absent internal investigation
target recovers to Patrol. The optional protobuf target remains absent outside
Investigate.

The task brief mentioned detected-player diagnostics, but the frozen protobuf
offers only `failure_reason` and `failure_guard_id` for guard failures. The
approved design requires those fields, so simulation preserves the contract and
does not invent a new serialized field.

## 2026-09-23 — Release evidence and scope

Treat `b35349d` as the integrated P2 code revision for release verification and
two-stack isolation. Preserve the exact JSON/PNG artifacts outside Git in the
release checkout before deleting Compose volumes. The tracked `STATE.md` records
the reproducible commands and decisive values so later review does not depend
on transient containers or screenshots being committed.

Keep the visual and E2E checks on the release/runtime images. The combined dev
image remains the cross-language verification environment. Both paths use
container Chromium with SwiftShader WebGPU, while Mesa llvmpipe Vulkan provides
the compositor in this software environment. Do not turn the software adapter
into a gameplay or rendering authority assumption.

Carry forward the target/Echo tolerance and single screenshot sample as review
minors rather than silently treating passing runs as a proof of stronger
properties. The final release images receive separate human inspection for
filled floor, walls, guard body, and visible state cues.
