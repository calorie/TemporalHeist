# P3 complete game loop

## Goal

Deliver one coherent two-player heist mission: use the established Echo stealth
mechanics, steal data from a vault terminal with a live player, open the final
Echo-powered door, and extract together.

The approved design is
`docs/superpowers/specs/2026-09-23-vault-data-heist-design.md`.

## Review stack

1. `p3/contract-map`
2. `p3/authority-mission`
3. `p3/client-presentation`
4. `p3/full-mission-e2e`

Each branch is based on the branch immediately below it. The default branch is
only the base of the first layer.

## Invariants

- All P0-P2 gameplay, authority, Echo, MoQ, raw WebGPU, container, and runtime
  isolation invariants remain binding.
- Only a connected live player can secure the vault data.
- The objective is an attempt-scoped team fact, not carried inventory.
- Protocol changes remain additive under protocol major 1.
- The authority owns theft validation, objective state, reset, and victory.
- Project execution and every verification command remain container-only.

## Acceptance criteria

- The authored vault terminal has a stable map identity and interaction radius.
- Invalid, Echo, and out-of-range actions cannot secure it.
- One valid live-human action secures it exactly once and both clients agree.
- Extraction cannot win before the objective is secured.
- Victory requires secured objective, Echo-opened final door, and both humans in
  extraction.
- Restart restores the unsecured objective.
- HUD, audio, and raw WebGPU make the state and next step legible.
- Full containerized two-browser acceptance and existing isolation contracts pass.
