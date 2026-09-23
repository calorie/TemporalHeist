# P2 Guard and Echo stealth design

## Intent

P2 turns the established ten-second Echo mechanic into a deliberate stealth
tool. Two players must use a recorded Echo route to draw an authority-controlled
patrol guard away from a guarded passage, then cross and extract together. The
feature must deepen the game without weakening deterministic simulation, server
authority, first-generation Echo semantics, MoQ transport, raw WebGPU rendering,
or container-only verification.

## Player experience

The facility gains one guarded passage and a visible patrol route. Walking into
the guard's view as a live player fails the attempt. An Echo entering that view
does not fail the attempt: the guard leaves its patrol, walks to the last observed
Echo position, pauses to search, then returns to its route. This creates a readable
cooperative solution: player A records a decoy route, both players reposition,
A's Echo draws the guard away exactly ten seconds later, and player B crosses the
guarded passage during the opening. Both players must still complete the existing
Echo-door and extraction objectives.

The UI explains that guards catch humans but investigate Echoes. The guard, patrol
route, view cone, last-seen marker, and normal/investigating/returning states have
distinct raw-WebGPU presentation. Audio cues may reuse the existing synthesized
audio system for alert and investigation transitions.

## Authority model

The Rust simulation owns all guard gameplay state. P2 adds a single guard with:

- a stable guard ID;
- an integer position and facing direction;
- an ordered, cyclic list of stable waypoint IDs;
- one of `Patrol`, `Investigate`, or `Return`;
- the current waypoint or last-seen Echo target;
- deterministic state-entry and search-expiry ticks;
- the last Echo observation key used to suppress repeated retriggering.

Movement uses integer units per authority tick. Waypoints and the guarded passage
are checked-in map data. The first implementation follows straight unobstructed
segments and does not introduce general pathfinding. Target arrival clamps to the
target position so it cannot oscillate or overshoot.

Each active tick follows this order:

1. advance the guard toward its current patrol, investigation, or return target;
2. use the configured watch facing during Patrol; derive Investigate/Return
   facing from the chosen movement segment, restoring watch facing on rejoin;
3. test live humans in its deterministic view cone;
4. fail immediately if a connected live human is visible;
5. otherwise test eligible first-generation Echo poses;
6. record the newest visible Echo position and enter `Investigate` once for that
   observation key;
7. on reaching the investigation point, search for a fixed duration;
8. enter `Return`, move to the deterministic patrol rejoin waypoint, then resume
   the patrol cycle.

The view cone uses integer dot/cross-product comparisons and an explicit maximum
range. Static walls may block sight only where a checked-in sight-blocking segment
exists; P2 will not add a general physics or navigation engine. When both a human
and Echo are visible on the same tick, human detection wins. Terminal and lobby
phases freeze guard movement and timers just like other gameplay systems. Restart
restores the guard's initial position, patrol index, and state.

An Echo observation key consists of source player ID plus a bounded source-tick
window. Continuous visibility of one replay segment cannot indefinitely restart
the investigation timer. A later distinct replay segment may trigger a new
investigation. Guards never alter Echo position, history, timing, generation, or
mechanism effects.

## Protocol and map contract

`proto/temporal_heist.proto` remains protocol major 1. Additive fields expose guard
snapshots and the guard failure source. Each guard snapshot contains stable ID,
integer pose/facing, state, current waypoint ID, optional investigation position,
and state-entry/search-expiry ticks. Values required by gameplay are published by
the authority; clients do not reconstruct guard AI from waypoints.

`map/facility.json` gains the patrol waypoints, route order, guarded-passage
geometry, and any sight blockers needed by the one authored encounter. Guard 51
patrols east of the choke from `(19100,4000)` to `(20500,4000)`, always watching
west during Patrol. Its unchanged cone covers every reachable west-entry point
throughout the route. The 140-tick period gives the 600-tick Echo a different
patrol phase, allowing a decoy recorded out of range to be seen on replay. Generated
TypeScript remains derived from the protobuf source. The protobuf, generated-code
definition, map semantics, and container command contract are synchronization
boundaries. They are frozen and cross-language verified before parallel component
implementation begins.

## Client and rendering

The client timeline stores guard snapshots alongside the canonical world snapshot.
Presentation may interpolate guard position between received snapshots, but the
authority state and detection result remain canonical.

Raw WebGPU draws the guard body, facing indicator, view cone, patrol path, and
investigation marker. State colors are stable and accessible through both visual
inspection and deterministic GPU pixel/readback or geometry tests. Renderer state
never feeds gameplay. The DOM HUD reports a short objective and guard state so the
puzzle remains understandable even when software rendering is slow.

## Failure handling

Live-human detection uses the existing authority-owned failed phase and restart
flow. P2 adds a distinct guard failure reason and guard ID for diagnostics and UI.
Missing or malformed map guard data fails authority startup with a clear error.
Unknown enum values or absent additive fields decode to a safe client fallback and
must not crash rendering. Missing investigation targets return the guard to patrol.

## Verification

Pure Rust tests cover patrol cycling, exact state transitions, arrival clamping,
view-cone boundaries, human-over-Echo priority, continuous-Echo deduplication,
investigation expiry, deterministic return, phase freezing, and restart reset.

Protocol tests round-trip every guard state and guard-caused failure between Rust
and TypeScript. Browser tests cover timeline ingestion, HUD text, interpolation,
and render geometry/colors.

Containerized two-client E2E proves:

1. direct live-player entry into the guard cone fails and both clients agree;
2. restart produces the initial guard state;
3. player A records the authored decoy route;
4. exactly 600 authority ticks later A's Echo reaches the lure region;
5. the authority moves the guard through `Investigate` and away from the passage;
6. player B crosses while the guard investigates without a failure;
7. both players complete the existing Echo-door and extraction requirements;
8. both clients render the same authoritative guard/result state through raw
   WebGPU with no browser, shader, or validation errors.

Final verification uses the stable container entry points for format, lint,
typecheck, unit, protocol, transport, integration, E2E, WebGPU, visual evidence,
and two simultaneous isolated full stacks. CI continues to call the same entry
points and does not install host-native language or browser toolchains.

## Scope limits

P2 contains one authored guard encounter, fixed straight-line waypoints, and three
guard states. It does not add general navigation meshes, dynamic obstacle routing,
combat, capture animations, inventories, multiple Echo generations, guard-to-guard
coordination, persistence, matchmaking, or production authentication.
