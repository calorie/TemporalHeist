# P3 Vault Data Heist Design

## Intent

Turn the existing technical vertical slice into one coherent heist mission. Two
players must use the established ten-second Echo and guard diversion mechanics,
steal data from a vault terminal with a live human, open the final Echo-powered
door, and escape together. The design should make the objective legible without
introducing inventory, carrying, drops, scoring, checkpoints, or another generic
item subsystem.

## Mission flow

1. Both players ready in the lobby and the authority starts an attempt.
2. The players solve the existing presence and surveillance spaces.
3. A recorded Echo diverts guard 51, allowing both live players to cross the
   guarded choke.
4. A connected live player enters the vault terminal radius and presses the
   existing action input (`E`).
5. The authority secures the mission objective and publishes that state to both
   clients.
6. The players record and use Echo Presence on plate 23 to open door 13.
7. The authority declares victory only when the data is secured, the final door
   has been opened by an Echo, and both live players occupy extraction.
8. Restart restores the terminal and clears all mission-objective state.

## Authority and interaction rules

The authority is the only writer of the mission objective. P3 reuses the
existing `ACTION + target_id` input and its canonical server-tick ordering. An
action secures the data only when the attempt is active, the input belongs to a
connected live player, the target is the authored vault terminal, and the
authoritative live pose is within its interaction radius.

Echoes cannot secure the objective. Delayed Echo Action pulses addressed to the
vault terminal are ignored, keeping the terminal's Echo capability `None`.
Out-of-range, wrong-target, disconnected, duplicate, lobby, won, and failed
actions have no effect. The first valid action changes the attempt-scoped state
once; later actions are idempotent.

The objective does not have a carrier. It remains secured after the acquiring
player moves or disconnects. This is a team mission fact, not an inventory item.

## Contract and map

Keep protocol major 1. Add one optional-compatible boolean to `RoomState`:

```proto
bool objective_secured = 12;
```

Absent data decodes as `false`. Do not duplicate the state in `Snapshot`, add a
mission-phase enum, or serialize player attribution or acquisition tick. The
room snapshot already provides the canonical epoch and tick needed for client
agreement and event evidence.

Add one explicit vault objective record to `map/facility.json` with a globally
unique stable ID, position, and interaction radius. This record is the source of
truth for Rust validation, browser targeting, and rendering. It is distinct from
the existing Echo-Action terminals because its capability is live-human-only.
The final placement is in the secure room after the guarded choke and before
door 13, without changing the guard, plate, door, or extraction contracts.

The protobuf, generated TypeScript, map schema, and semantic documentation form
the serialized P3 contract boundary. They are changed and verified in the first
stack layer before dependent implementation proceeds.

## Simulation and reset

The simulation stores a single `objective_secured` attempt flag. A focused
target-resolution path validates the vault terminal independently of the
existing Echo-Action terminals. The win predicate becomes:

```text
objective_secured
AND echo_opened_final_door
AND extraction_players == 2
```

Extraction before theft is allowed as movement but cannot end the attempt.
Restart clears the flag along with the existing attempt state. Terminal state
freezes it under the same rules as other gameplay state.

## Client presentation

The browser includes the uncollected vault terminal in nearest-action targeting.
It never predicts success: presentation changes only after an authoritative
snapshot reports `objective_secured`.

Raw WebGPU renders a compact terminal/plinth from existing primitive geometry.
It is visibly active before theft and visibly secured after theft. The HUD guides
players through the current authoritative step:

- reach and operate the vault terminal;
- data secured, prepare the Echo escape route;
- final door open, reach extraction together.

The briefing states that only a live player can steal the data. Existing WebAudio
primitives provide one edge-triggered secured cue. No image/audio asset pipeline
or new UI framework is added.

## Failure handling

Existing guard, surveillance, deadline, transport, and restart behavior remains
unchanged. Invalid theft actions fail closed and do not create a new room failure
reason. A disconnected player cannot act, while data secured before disconnect
remains a team fact. Legacy clients may omit the new presentation but cannot
cause the authority to award an invalid win.

## Verification

The contract layer verifies protobuf regeneration, Rust-to-TypeScript round trips,
legacy absent-field decoding, map parsing, stable ID uniqueness, and container
contracts. The authority layer uses deterministic unit tests for every validity
condition, idempotence, win gating, terminal freeze, and reset.

Client verification covers nearest targeting, HUD progression, objective geometry,
authoritative-only state changes, and the audio edge. The existing single release
acceptance run is extended instead of adding another long browser suite. It proves:

1. extraction cannot win before theft;
2. Echo and out-of-range actions cannot steal;
3. one in-range live action is observed identically by both clients;
4. the secured presentation is visible;
5. both players win only after the Echo door and extraction conditions;
6. restart restores the unsecured terminal;
7. browser, renderer, screenshot, WebGPU, and transport checks remain clean.

All commands, services, Chromium processes, WebGPU checks, and tests remain
container-only. Release verification retains the existing two-stack isolation
contract and unique per-agent runtime resources.

## Review dependency graph

P3 is one dependent GitHub PR stack:

1. `p3/contract-map`: additive protobuf/map contract, generated code, semantic
   documentation, compatibility checks.
2. `p3/authority-mission`: deterministic theft validation, objective state,
   reset, and win gating.
3. `p3/client-presentation`: targeting, HUD, audio, raw WebGPU terminal.
4. `p3/full-mission-e2e`: complete two-browser mission, visual evidence, and
   release verification.

Each layer is independently reviewable and verified. Contract defects are fixed
in the lowest layer and propagated upward. Upper layers proceed on the stable
lower contract without waiting for default-branch merges.

## Acceptance criteria

P3 is complete when a containerized two-player run starts in the lobby, uses the
existing Echo guard diversion, secures data through one valid live-human terminal
action, opens the final door through Echo Presence, and wins through simultaneous
extraction; both clients agree on every authoritative result and render it with
raw WebGPU. The same run proves invalid theft and reset behavior, all repository
checks pass, and the stack records reproducible verification evidence.
