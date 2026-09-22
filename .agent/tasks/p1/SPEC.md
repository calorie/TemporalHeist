# P1 playable prototype

## Goal

Turn the P0 networked Echo proof into a repeatable two-player game session, then
add the first stealth pressure and presentation pass without weakening the P0
authority, timing, transport, WebGPU, or container-isolation guarantees.

## Milestones

### P1.1 — Authority-owned game loop

- Both connected players explicitly become ready before an attempt starts.
- The authority owns lobby, active, won, and failed phases.
- An attempt has an authority-tick time limit and deterministic reset.
- Completion requires both live players in extraction after the final door has
  been opened by Echo Presence during the current attempt.
- Both clients show the same phase, objective, timer, readiness, and result.
- Either player may request a reset after a terminal result; both players must
  ready again for the next attempt.
- Containerized E2E proves ready, play, win, reset, and a second start.

### P1.2 — Stealth pressure

- Add one authority-owned deterministic surveillance hazard with clear telegraphy.
- Detection produces the P1.1 failed phase and supports the same reset flow.
- Echo trajectory and effects retain all P0 semantics.

### P1.3 — Playability and presentation

- Make controls, current objective, Echo timing, failure, success, and retry
  understandable without test-only APIs.
- Add a concise onboarding path and visual/audio feedback using repository-native
  assets and raw WebGPU rendering.
- Complete a containerized manual visual pass and automated two-client E2E.

P1.3 is accepted when:

- the visible UI explains movement, interaction, readiness, the plate → leave →
  10-second Echo replay → door loop, surveillance avoidance, extraction, and retry;
- an authority-tick-derived indicator counts down the first Echo and then states
  that the Echo is replaying exactly 10 seconds behind;
- the extraction zone is visibly rendered by raw WebGPU and success/failure have
  distinct presentation states;
- native Web Audio synthesis provides user-unlocked, muteable cues for meaningful
  Echo, door, success, and failure transitions without affecting gameplay;
- two containerized clients use visible keyboard/button controls for ready and
  retry, assert the human-facing HUD states, and retain the existing canonical
  gameplay and GPU assertions;
- the containerized visual route exposes both player pages and records labeled
  screenshots plus renderer/error metadata for review.

P1.3 does not change protobuf, authority simulation, Echo semantics, or the map
source of truth. Presentation derives only from existing authoritative snapshots
and checked-in facility geometry.

### P1.4 — Release candidate

- Run format, lint, typecheck, unit, protocol, transport, integration, E2E,
  WebGPU, visual, and two-stack isolation verification in containers.
- Record limitations and reproducible commands, and prepare a merge-ready PR.

## Constraints

- All invariants in the vertical-slice specification and project context remain
  binding, including the exact 600-tick first-generation Echo.
- Gameplay outcomes come only from the 60 Hz Rust authority.
- Protocol additions remain backward-compatible within protocol major 1.
- Project processes run only through containerized entry points.
- Parallel writers use isolated worktrees and unique Compose resources.

## Acceptance criteria

P1 is complete when all four milestones pass their containerized verification,
two human players can complete and replay the session through the visible UI,
and the full result is reproducible in two simultaneous isolated stacks.
