# P1 state

## Status

P1.1 is merged on `main` at `4b6f89a`. P1.2 surveillance implementation,
independent review remediation, and integrated acceptance verification pass.

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
- Froze the P1.2 contract at `f017c54`, then implemented simulation, raw WebGPU
  telegraphy/HUD, and two-client E2E in three isolated worktrees.
- Integrated live-human detection, Echo immunity, terminal pose freezing,
  surveillance diagnostics, and clean restart to attempt 3.

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
- `sh container p12-contract-0922 ... spikes/protocol/check.sh`: Rust/TypeScript
  P1.2 failure and hazard fields round-tripped successfully.
- `sh container p12-integrated-0922 verify`: codegen, protocol, Rust fmt/clippy,
  25 Rust tests, TypeScript, Biome, browser tests, Vite, and Chromium WebGPU passed.
- Fresh `sh container p12-integrated-0922 acceptance`: existing attempt-1 win,
  exact 600-tick Echo timing, attempt-2 Echo immunity, live-player surveillance
  failure on camera 41, frozen terminal positions, player-B restart, and clean
  attempt-3 lobby passed on both containerized Chromium clients.
- Both E2E clients reported SwiftShader WebGPU with no browser/renderer errors.
- Independent review found that the first cone placement was outside WebGPU's
  `0..w` clip-depth range. The corrected projection is covered by a geometry
  test and the E2E reads back an idle-teal and detected-red pixel from the GPU
  surface. Static primitive vertex buffers are now allocated once per renderer.
- Final `sh container p12-integrated-0922 verify` passed after review fixes:
  cross-language protocol checks, 25 Rust tests, rustfmt, clippy, TypeScript,
  Biome, browser tests, production build, and the containerized WebGPU probe.
- Final `sh container p12-integrated-0922 acceptance` passed the complete
  two-client game loop through attempt 3, including GPU surface color assertions,
  with both clients on SwiftShader and no captured errors.

## Current work

1. Publish the P1.2 PR and monitor CI.
2. Begin P1.3 onboarding and presentation after integration.

## Blockers

None.

## Next action

Publish the merge-ready P1.2 branch and monitor CI.
