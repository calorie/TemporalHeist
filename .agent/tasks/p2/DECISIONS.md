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

The isolation run also exposed a stale visual probe: the Echo can turn the guard
between a snapshot-selected pixel and readback while its 30-tick source window
remains open. The harness therefore waits until `stateEnteredTick + 30` before
sampling the investigation cone. That guarantees a retained target by existing
authority semantics. Live crossings run concurrently with this presentation
check, so neither gameplay nor the authority clock pauses.

A later isolation run passed both guard crossings but exposed the prior final
extraction script's second patrol wait. Door 13's Echo window opened at 11811;
A was still blocked at X 21738 when the guard caught it at 12572, after that
600-tick window expired. Both players now verify Echo-only Presence on plate 23
and take one westbound Patrol window (guard X 18800..19200) to approach and
extract concurrently. Both aim deep inside extraction while waiting for the
other. Door timing and guard gameplay are unchanged; the harness no longer
assumes two sequential patrol windows fit inside one Echo window.

Final verification is anchored to code revision
`d2f1a59fdc2c2e28ea828fa42c6ea04f833bb6a4`: full verification, fresh acceptance,
separate visual verification, and both concurrently running clean-worktree
acceptances passed. The final main run rejected both side bypasses at tick 9429,
observed the exact 600-tick Echo at 10113, crossed both live players during
Investigate at 10188/10200, and extracted both at 11988. Both isolation branches
used the same code SHA and passed resource independence and teardown checks.
Original `b35349d` and intermediate `1f92349`/`ac847cf` evidence is retained only
as history and is superseded by the final `p2-final-fix-release-*` artifacts.
The final evidence-only commit does not change code, map, or test behavior.

## 2026-09-23 — Mandatory diversion after limited review

The earlier walls force entry through the opening but do not make the Echo
necessary: with the guard at `(19000,4000)` moving east, a player can move from
`(17700,6000)` north for 30 ticks, east for 20, then north to `(18900,1500)`
without being seen. The real continuous-input regression reproduced this ACTIVE
result with no Echo. An independent entry-coverage regression also failed.

The smallest robust correction keeps the guard's cone and Echo behavior but
makes Patrol retain its configured watch facing `(-1000,0)` while moving between
waypoint 511/start `(19100,4000)` and unchanged waypoint 512 `(20500,4000)`.
Investigate/Return still face movement; rejoining Patrol restores westward
watching before detection and snapshot publication. Existing rendering consumes
that authoritative facing directly. No invisible gate or separate detection
shape is added. Walls 107/108, passage, plate 23, door 13, and extraction are
unchanged from the serialized geometry correction.

Starting at 19000 would create a 150-tick route period that divides the 600-tick
Echo delay: a safely recorded pose would replay at the same patrol phase.
Starting at 19100 gives a 140-tick period and 40-tick replay offset without
changing range 2600, half-width 1400, speed 20, or search duration 180.
The authored decoy is now near `(17400,3800)`, recorded as the guard moves east
out of range. Players wait until the Echo draws the guard west to X <=17800
before entering its former watch area. The exact 600-tick Echo source rule,
30-tick target update window, and original final door/extraction puzzle remain.

The coverage regression samples all four corners of X `18100..18160`,
Z `3550..4450` at every patrol tick across both endpoints. Actor radius 250
constrains entry to that Z interval and maximum motion 60 cannot skip that slab.
The convex radial-clipped cone contains the whole slab if it contains its four
corners. Thus no no-Echo route can cross the barrier during Patrol, independently
of the concrete reviewed path. Existing Echo/search/Return/reset tests also pass.
