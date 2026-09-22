# P2 patrol-guard stealth puzzle

## Goal

Add one deterministic authority-owned patrol guard and an authored cooperative
encounter in which a first-generation ten-second Echo acts as a decoy, allowing a
live player to cross a guarded passage and both players to complete the heist.

The detailed approved design is
`docs/superpowers/specs/2026-09-23-guard-echo-stealth-design.md`.

## Invariants

- All P0/P1 gameplay, protocol, WebGPU, MoQ, container, and isolation invariants
  remain binding.
- The authority owns guard movement, perception, state transitions, failure, and
  reset at 60 Hz using deterministic integer rules.
- A live human seen by a guard fails the attempt. An Echo causes investigation but
  cannot itself fail the attempt.
- Human detection wins when a human and Echo are visible on the same tick.
- Guards never modify Echo trajectory, timing, history, generation, or effects.
- P2 adds no general pathfinding or client-authoritative gameplay.

## Milestones

### P2.1 — Contract and deterministic guard simulation

- Freeze additive protocol-major-1 guard snapshots and guard failure diagnostics.
- Add authored guard waypoints and guarded passage to the map contract.
- Implement and unit-test Patrol, Investigate, Return, perception, deduplication,
  phase freezing, failure, and reset in pure Rust.

### P2.2 — Authority transport and client presentation

- Publish canonical guard state over the existing MoQ authority feed.
- Decode/store guard snapshots in the browser timeline.
- Render guard, route, view cone, state, and investigation target using raw WebGPU.
- Explain guard/Echo behavior through the visible HUD and presentation feedback.

### P2.3 — Playable encounter and acceptance

- Prove direct human detection and restart.
- Prove an Echo observed exactly 600 ticks behind draws the guard away.
- Prove player B crosses safely during investigation and both players extract.
- Capture containerized two-client visual and WebGPU evidence.

### P2.4 — Release verification

- Pass all containerized component, protocol, integration, E2E, WebGPU, visual,
  and two-stack isolation checks.
- Record commands, evidence, backend information, limitations, and next action.

## Acceptance criteria

P2 is complete when all four milestones are merged and reproducible through the
stable container entry points, the authored puzzle cannot be solved by a live
player walking through the guard's view, the ten-second Echo decoy creates the
verified crossing window, both clients agree on every authoritative result, and
two independent full stacks can complete concurrently without shared mutable
runtime resources.

