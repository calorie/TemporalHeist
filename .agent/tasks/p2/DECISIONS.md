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
was initially the rectangle X `18500..19500`, Z `3000..5000`. The serialized
final-review correction below replaces this metadata-only crossing. No navigation
mesh is added.

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

The original release used `b35349d` as its integrated P2 code revision for release verification and
two-stack isolation. Preserve the exact JSON/PNG artifacts outside Git in the
release checkout before deleting Compose volumes. The tracked `STATE.md` records
the reproducible commands and decisive values so later review does not depend
on transient containers or screenshots being committed.

Keep the visual and E2E checks on the release/runtime images. The combined dev
image remains the cross-language verification environment. Both paths use
container Chromium with SwiftShader WebGPU, while Mesa llvmpipe Vulkan provides
the compositor in this software environment. Do not turn the software adapter
into a gameplay or rendering authority assumption.

The original review deferred the target/Echo tolerance and single screenshot
sample; the final-review correction below resolves both. Original `b35349d`
evidence is historical and does not validate the final map or rendering.

## 2026-09-23 — Serialized final-review correction

Walls 107 and 108 occupy X `18100..18500`, respectively Z `0..3300` and
`4700..8000`. The new `guardedPassage` is the opening X `18100..18500`,
Z `3300..4700`. Closing both side lanes forces live traversal through this
opening before reaching plate 23. The 250 mm actor radius leaves 900 mm of
center clearance. Guard 51, waypoint 511 `(17200,4000)`, waypoint 512
`(20500,4000)`, plate 23 `(19500,2500)` with radius 750, door 13
X `22000..22400`/Z `3000..5000`, and extraction X `22800..23750`/
Z `3000..5000` remain unchanged. All map edits have one serialized owner.

A records the decoy near `(16300,3800)` on the west side while the guard moves
east, retreats north, and stages at `(17500,2000)`; B stages south near
`(17700,6000)`. Both former side bypasses are attempted and rejected before
recording. The replay draws the guard west and both live players cross the
opening at Z 4200 during Investigate. The final plate recording approaches and
leaves from the north, so it never needs to recross the choke. This is map-only
collision authoring: no new gameplay gate, guard AI, sight blocker, pathfinding,
or Echo rule is introduced.

The first release attempt rejected both bypasses but missed the lure: at source
tick 9582 the guard was at X 18280, and 600 ticks later it was near X 17320;
the observed decoy `(16369,3450)` lay just outside its angular edge. Recording
now starts earlier (guard X 17400..17600 heading east) and reaches Z 3800,
giving the later westward cone a substantial margin. Only the harness route
changed; authority rules and map stayed fixed.

The target assertion bounds each coordinate by elapsed authoritative ticks since
the investigation began times the map's speed per tick. It preserves exact
600-tick source delay and accounts for skipped publications and a retained
target across the 30-tick observation window without assuming exact X equality.

Screenshot acceptance samples the saved PNG's known floor and wall colors and
requires a separate 16x32 solid guard-body color patch. The search follows the
encounter region rather than a stale guard snapshot; the smaller target marker
cannot qualify. Flat clear-color and floor-color frames and a scene missing the
guard are rejected. This check complements inspection; it does not claim full
image equivalence.

The guard uses its existing angular wedge plus a fragment-stage radial clip at
the authority range. Cameras retain their triangular semantics. World-space X/Z
distance makes the clip independent of guard facing. The only new instance
attribute is an optional radial range (zero disables clipping). GPU results never
enter authoritative state. Matched Rust and real renderer samples check an inner
point, the old triangular far corner, and a point outside the angular edge.
