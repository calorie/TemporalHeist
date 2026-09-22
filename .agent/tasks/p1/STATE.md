# P1 state

## Status

P1.1 is merged on `main` at `4b6f89a`. P1.2 is merged on `main` at `a0fa12e`.
The P1.3 playability and presentation contract is frozen for implementation.

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
- PR #6's first CI run exposed an invalid E2E assumption: the browser observed
  plate activation 30 ticks after the authoritative Echo source tick. The test
  now brackets the source with the pre-recording and observed-release ticks while
  retaining the exact canonical `echoed.serverTick - sourceTick == 600` check.
- Fresh `sh container ci-fix-0922 acceptance` passed after the fix. It exercised
  a 603-tick browser-observed delay while still proving the exact 600-tick
  authority delay, then completed surveillance failure and reset without errors.
- CI component and acceptance verification now run concurrently in isolated
  Compose namespaces and superseded runs are cancelled. The failed serial run
  took 20m09s for components plus 9m02s for acceptance; expected wall time is
  now bounded by the slower parallel job rather than their sum.
- PR #6 merged as `a0fa12e`; its parallel CI jobs passed in approximately four
  and eight minutes respectively.
- Audited P1.3 UI, renderer/audio, E2E, and visual workflows. Frozen a client-only
  boundary with no protocol, authority, simulation, or map-data changes.

## Current work

1. Implement P1.3 UI/audio, raw WebGPU extraction presentation, and human-facing
   E2E/visual evidence in isolated worktrees.
2. Integrate, independently review, and run full container verification.

## Blockers

None.

## Next action

Commit the P1.3 presentation contract, then begin the parallel implementation wave.
