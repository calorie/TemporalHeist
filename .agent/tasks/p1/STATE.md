# P1 state

## Status

P1.1 is merged on `main` at `4b6f89a`. P1.2 surveillance implementation is in
progress; its protocol/map contract is the current synchronization boundary.

## Completed

- P0 vertical slice and post-merge hardening are on `main` at `b66148d`.
- Compared the installed and cloned agentic-engineering policy: both are 0.5.2.
- Selected agentic-engineering as the single scheduler and Superpowers TDD,
  systematic debugging, and verification as implementation methods.
- Added repository guidance to continue through reversible ambiguity and routine
  failed checks without requesting user decisions.
- Defined the P1 milestone sequence and P1.1 authoritative game-loop semantics.
- Froze the additive protocol and extraction-map contract at `62975fd`.
- Implemented the deterministic Rust lifecycle, visible browser controls/HUD,
  and two-client E2E in three isolated worktrees.
- Integrated lobby, ready, active, won, failed, restart, attempt timing, Echo
  proof, extraction, and inactive-phase gameplay freezing.
- Independent review found a lobby pre-positioning bypass. ACTIVE-only gameplay
  advancement and clearing held lobby motion fixed it with regression coverage.
- Published `p1/game-loop-foundation` as PR #5.
- PR #5 merged as `4b6f89a`.
- Defined the P1.2 static camera, integer view cone, failure diagnostics, and
  Echo immunity semantics.

## Verification

Passed in containers on 2026-09-22:

- `sh container p1-contract run --rm dev sh spikes/protocol/check.sh`: TypeScript
  Ready input decoded by Rust; Rust P1 room state decoded and asserted by
  TypeScript.
- `sh container p1-integrated-0922 verify`: codegen consistency, protocol spike,
  Rust fmt/clippy/tests (19 tests at integration, 20 after phase-freeze coverage), TypeScript typecheck, Biome, browser unit and
  contract tests, Vite build, and containerized Chromium WebGPU probe all passed.
- `sh container p1-integrated-0922 run --rm dev ... th-sim ...`: after phase
  freezing, fmt/clippy and 12 simulation tests passed.
- Fresh `sh container p1-integrated-0922 acceptance`: two containerized Chromium
  clients passed ready → active, reconnect, all three exact-600-tick Echo doors,
  both-player extraction, won, restart/reset, and second active attempt.
- Acceptance WebGPU adapters: both clients reported Google/SwiftShader fallback,
  `rgba8unorm`, with no captured browser or renderer errors.
- GitHub PR #5: `validate` passed in 1m15s and `container-verification` passed in
  13m25s using the repository container entry points.

## Current work

1. Verify and commit the additive P1.2 protocol/map contract.
2. Implement simulation, raw WebGPU telegraphy/UI, and two-client E2E in isolated
   worktrees.

## Blockers

None.

## Next action

Run P1.2 code generation and cross-language compatibility in a container, commit
the synchronization boundary, then start parallel implementation.
