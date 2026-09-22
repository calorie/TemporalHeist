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

## Post-P0 candidates

After the core slice works, candidates include:

- static surveillance cameras and detection cones;
- guards reacting to humans and/or Echo Sensors;
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
