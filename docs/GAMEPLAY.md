# Gameplay design

## Core fantasy

Temporal Heist is cooperative infiltration built around collaborating with committed versions of the players' own recent past.

The world does **not** rewind. Only a player's past presence/action timeline is projected forward as an Echo.

At authority tick `T`, a player's Echo represents that same player's committed human state at tick `T - 600`.

## The central rule

An Echo is history projected into the current world.

This distinction matters:

- the Echo's **trajectory** belongs to history and cannot be changed by current collision;
- the Echo's permitted **effects** happen in the current authoritative world;
- the current world never rewinds to the historical world state;
- Echo effects do not become new source history.

Example:

~~~text
Historical tick T
    Alice walks through an open doorway and stands on Plate A.

Current tick T+600
    The doorway is now closed.
    Echo Alice still follows the historical trajectory through the doorway.
    When Echo Alice overlaps Plate A, Plate A becomes active in the current world.
~~~

That predictability is intentional. A planned time puzzle must not fail merely because the current collision scene differs from the one in which the route was recorded.

## Actor classes

### Human player

- obeys current collision;
- can generate movement/action intents;
- can activate ordinary live-player mechanisms;
- can create canonical history after authority validation.

### Echo

- is owned by a human player's original timeline;
- exists only when sufficient history exists;
- does not collide with current walls/doors for movement;
- cannot be pushed or redirected;
- cannot generate input;
- can affect only explicitly Echo-enabled mechanisms;
- never creates source history.

## Interaction capability model

Every interactable has one Echo capability.

### None

Echo has no effect.

Examples for future content:

- loot;
- extraction zone;
- key pickup;
- inventory container;
- physical crate.

### Presence

The authority computes overlap of eligible actor poses against a trigger volume.

Examples:

- pressure plate;
- laser interruption zone;
- presence scanner.

For MVP, a plate is active when at least one eligible live player or eligible Echo overlaps it. The plate drives the linked current-world door state.

### Action

A human's action is first validated and accepted by the authority. If the target is Echo-Action-capable, that accepted action schedules one delayed Echo pulse exactly 600 ticks later.

The pulse is addressed to the same stable target ID.

Do not use a generic toggle semantic. Prefer target-specific commands/pulses such as:

- `press`;
- `activate`;
- `authorize`;
- `open_request`.

At replay time the target's current state machine consumes the pulse. This allows current world state to matter without invalidating the historical fact that the player successfully performed the action.

## Echo lifecycle

For a new player:

1. Human joins at tick `J`.
2. Human history begins committing.
3. No Echo exists for ticks `< J + 600`.
4. At `J + 600`, the first historical human pose becomes available and the Echo appears.
5. On each following tick, Echo samples exactly 600 ticks behind the current authority tick.

If a human disconnects, implementation may keep replaying already committed retained history until no delayed sample remains, then remove the Echo. P0 may choose the simpler behavior if reconnect semantics are documented and deterministic.

## Echo identity

An Echo is not a new player.

Stable identity should carry:

- source player ID;
- generation index (`1` for P0);
- sampled source tick.

Do not assign the Echo an independent mutable gameplay history that can recursively spawn another Echo.

## Vertical-slice level

The slice uses one tiny facility divided into three logical zones.

### Zone 1 — Live presence tutorial

Goal: establish normal world rules.

- closed door blocks a live player;
- plate opens the linked door while occupied;
- players can visually understand plate → door causality.

### Zone 2 — Echo presence

Goal: teach temporal planning.

- a player stands on a designated plate;
- the player leaves and moves to the far side / another location;
- 10 seconds later the Echo retraces the recorded route;
- Echo presence opens the current door.

A visible countdown/trail/debug timeline may be used in the prototype to make the mechanic legible.

### Zone 3 — Cooperative proof

Goal: prove two-player temporal coordination.

Required solution shape:

- Player A records a route that occupies the mechanism;
- later, A is free to move elsewhere;
- A's Echo activates/holds the mechanism;
- Player B crosses the linked authority-controlled gate during the Echo window.

An Echo Action terminal can be added if useful, but P0 completion does not depend on polished puzzle density.

## Failure/edge semantics

### Closed door on historical route

Echo passes through. Live players remain blocked.

### Live player overlaps Echo

No physical collision is required. They may visually overlap.

### Two Echoes or Echo + human on the same plate

Presence is set/union semantics. One or more eligible actors means active.

### Action replay target missing

Ignore the pulse safely and record diagnostics. The static P0 level should not delete targets.

### Duplicate action delivery from network

Authority deduplicates human intent by sequence/identity before acceptance. Exactly one accepted action produces at most one delayed Echo pulse.

### Current target state differs

The Echo pulse still arrives. The target's current state machine decides its current effect. This is why toggle semantics are avoided.

## Presentation goals

Echoes should be immediately distinguishable from live players.

P0 presentation may use:

- translucency;
- temporal trail samples;
- a different material/noise treatment;
- a visible 10-second timeline indicator.

Do not make presentation state authoritative.

## Post-P2 candidates

After the core slice works, candidates include:

- multiple Echo delays/generations;
- gadgets whose delayed effects compose with Echoes;
- richer Action targets;
- spectator/history scrubber using retained timeline data;
- procedural/heist level content.

None of these should delay proof of the core two-player Echo scene.

## P1 session loop

The first playable-prototype layer wraps the facility in an authority-owned
attempt:

1. Both connected players explicitly become ready in the lobby.
2. The authority starts attempt 1 and sets a five-minute deadline in server ticks.
3. Movement, history, Echoes, actions, and mechanisms advance only while active.
4. Door 13 must be opened by Echo Presence during the attempt.
5. Both live players then enter extraction to win.
6. Deadline expiry fails the attempt.
7. Either connected player may restart a terminal result. The authority respawns
   players, clears transient state, increments the attempt, and waits for both to
   become ready again.

The browser displays this state and sends intent, but cannot decide readiness,
timing, completion, failure, or reset effects.

## P1 surveillance

A static surveillance camera covers an optional side lane in zone 1. Its visible
triangular field of view is a warning rendered by raw WebGPU. A live human whose
center enters the cone immediately fails the active attempt on the authority
tick. The failure identifies the camera and detected player on both clients.

Echoes do not trigger surveillance. This keeps the historical projection useful
for temporal planning and ensures that the new stealth rule does not change Echo
trajectory or effect semantics. Timeout and surveillance remain distinct failure
reasons and both use the same deterministic restart flow.

## P1 playability and presentation

The lobby presents a short briefing for movement, interaction, readiness, the
plate → leave → ten-second Echo → door loop, surveillance, extraction, and retry.
Players use the visible Ready and Restart controls or their displayed keyboard
shortcuts. Losing browser focus clears held movement so returning to the page
does not continue a stale input.

During an attempt, the HUD derives its timer and first-Echo countdown from the
authority's server tick. After the first 600 ticks it states that Echoes replay
exactly ten seconds behind. Raw WebGPU renders the extraction marker and changes
the scene for authoritative success and failure; these colors never feed back
into gameplay. Short synthesized Web Audio cues announce Echo, door, success,
and failure transitions after user interaction unlocks audio. The mute control
is local presentation state and has no gameplay effect.

## P2 guard and Echo stealth

The facility has one authored guard, ID 51, patrolling between waypoints 511 at
`(19100, 4000)` and 512 at `(20500, 4000)` in millimetres. It watches west during
both directions of Patrol; movement and watch facing are deliberately separate.
Investigate and Return face their movement targets, and resuming Patrol restores
westward watching before detection. Published facing drives the visible cone.
Its view covers a
2600 mm radial range and the angular slope defined by a 1400 mm half-width
at 2600 mm forward distance. The renderer clips the cone at that same radius.
The guarded passage occupies X `18100..18500`, Z `3300..4700`. Wall 107 extends
north from it to Z 0; wall 108 extends south to Z 8000. Every live route to
plate 23 and the final door therefore goes through the central opening. The route
and passage are checked-in map data; guard movement follows straight segments.
Every reachable west-entry point stays in view across the complete patrol, so a
player cannot follow behind it through the opening and escape north. The patrol
period is 140 ticks, giving a 40-tick phase offset for the 600-tick Echo replay.

During an active attempt, a connected live human in the guard's view immediately
fails the attempt. The result identifies guard 51. If a human and Echo are visible
on the same tick, the human failure wins. An Echo never causes a failure or changes
its historical route. Instead, the guard investigates the last observed Echo
position, searches there for 180 authority ticks, and returns to its patrol. A
continuous 30-tick Echo observation window can update the last-seen position but
cannot extend the search timer indefinitely.

Player A can record a west-side decoy near `(17200, 3800)` while the guard moves
east through X `20000..20200`, out of range. A then retreats north and returns
around the west edge at X 15800 to join B near `(17800,6000)`, south of the lure.
Both players remain west of the choke. Exactly 600
authority ticks later, A's first-generation Echo follows that route and draws the
guard west, away from the choke. Both players wait until it has been drawn clear
of the opening, then cross while it investigates.
Plate 23 at `(19500, 2500)`, door 13 and extraction retain their existing geometry.
P3 victory requires a live human to secure objective 61, Echo Presence on
door 13, and both live players in extraction. Terminal and
lobby phases freeze guard movement and timers; restart restores its initial patrol
state. The HUD, guard body, route, view cone, and target marker explain the window
to cross, while the Rust authority alone decides detection and results.

## P3 vault objective contract

The checked-in facility adds vault objective 61 at `(21000, 4000)` with a
750 mm interaction radius. A connected live human must use the existing
targeted Action to secure the data. Echo Action cannot secure it; the vault
has no Echo capability. Secured data is a team fact for the current attempt,
not carried inventory. The room snapshot's `objective_secured` field reports
it. Older room messages omit that field and decode as unsecured. In this
contract layer the published value remains false until the authority mission
layer implements acquisition and reset.
