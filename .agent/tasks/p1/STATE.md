# P1 state

## Status

P1.1 is merged at `4b6f89a`, P1.2 at `a0fa12e`, and P1.3 at `57a44e8`.
P1.4 release-candidate implementation and local container verification are
complete on `p1/release-candidate`; publication and CI are next.

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
- Implemented P1.3 onboarding, visible controls, authority-tick Echo status,
  phase/result feedback, blur-safe input, synthesized audio, and mute control.
- Added raw WebGPU extraction and authoritative success/failure presentation.
- Extended the two-client E2E to assert the human-facing UI and labeled evidence.
- Split visual clients into separate Chromium services, profile volumes, and
  ephemeral CDP endpoints after independent review found shared profile state.
- Added a production two-worktree isolation harness with machine-readable
  resource, acceptance, teardown, and survivor-health evidence.
- Hardened E2E movement targets against delayed observation at extraction and
  surveillance boundaries. Isolation runs initialize all four Chromium clients
  together and temporarily idle stack B's rendering before its full scenario.

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
- `sh container p13-integrated-0922 acceptance`: both clients passed visible
  readiness, three doors, exact 600-tick Echo timing, Echo-held final-door
  crossing, extraction/win, surveillance failure, and restart to clean attempt 3.
- Both acceptance clients reported raw WebGPU on Google SwiftShader fallback,
  `rgba8unorm`, with empty browser/renderer error arrays.
- `sh container p13-integrated-0922 visual`: separate A/B Chromium profiles and
  ephemeral CDP endpoints each produced a labeled 1280x720 screenshot and
  metadata with SwiftShader WebGPU and no page/renderer errors.
- Final `sh container p13-integrated-0922 verify`: codegen consistency,
  cross-language protocol, 25 Rust tests, rustfmt, clippy, TypeScript, Biome,
  six browser test suites, Vite production build, and containerized Chromium
  WebGPU/WGSL validation all passed. The probe used Mesa llvmpipe Vulkan with a
  SwiftShader WebGPU adapter, `rgba8unorm`, and zero shader/validation errors.

Passed in containers on 2026-09-23:

- PR #7 CI passed: `validate` 1m15s, `component-verification` 3m16s, and
  `acceptance` 10m09s. Post-merge `main` CI for `57a44e8` also passed.
- `sh containers/verify-two-stack-isolation.sh /Users/a/TemporalHeist/.worktrees/p14-final-a
  p14-rc-a6 /Users/a/TemporalHeist/.worktrees/p14-final-b p14-rc-b6
  /tmp/temporal-heist-p14-final-isolation-6` passed both complete production
  acceptance scenarios at clean, identical executable revision `80f43c0`.
  Both browser services were live simultaneously and each contained independent
  Chromium A/B profiles.
- Final isolation resource evidence: container IDs A
  `046a704d063f,0fa62f94f654,eb6fb0967a77,fa5ab099b620`; B
  `518543fea118,6eeea8ad2c9f,c89e431813e3,f713a05b7d27`; network IDs A
  `ef0bee76b14c`, B `426df657f150`. Each stack had seven uniquely prefixed
  writable volumes and no published host ports. Both acceptance runs exited 0.
- Removing `th-p14-rc-a6` with volumes removed only A. Every B container,
  network, and volume ID remained unchanged, and an in-network B web health
  request passed. Machine evidence and separate acceptance logs are in
  `/tmp/temporal-heist-p14-final-isolation-6/`.
- A warm-cache single-stack `sh container p14-smoke acceptance` also passed at
  `80f43c0`. Its E2E automation uses quarter-speed authoritative feedback under
  software-GPU load; this preserved all gameplay assertions while preventing
  observation latency from skipping plates or narrow door openings.
- Final `sh container p14-final-0923 verify` passed codegen, cross-language
  protocol, rustfmt, clippy, 25 Rust tests, TypeScript, Biome, seven browser/
  contract suites, Vite production build, and Chromium WebGPU/WGSL validation.
  The probe reported Chromium 153, Mesa llvmpipe Vulkan 1.4.318, SwiftShader,
  `rgba8unorm`, zero shader errors, and zero validation errors. The same command
  passed again after the final E2E automation changes at executable revision
  `80f43c0`.
- `sh container p14-final-0923 visual` passed with separate Chromium A/B
  profiles and CDP ports `64942`/`64941`. Both 1280x720 labeled screenshots and
  metadata reported raw WebGPU/SwiftShader and empty page/renderer errors.
  Container-driven visible Ready actions confirmed ACTIVE HUD, player labels,
  the five-minute timer, onboarding, and Echo countdown on both clients.

## Current work

1. Run the final container verification at the release executable revision,
   commit this evidence-only state update, and publish the release-candidate PR.
2. Monitor its container-only CI.

## Blockers

None.

## Known constraints and unverified items

- Desktop Chromium is the supported target. Safari, Firefox, mobile, production
  authentication, persistence, matchmaking, WAN deployment, and relay clustering
  remain outside P1.
- Automated GPU evidence uses SwiftShader on Mesa llvmpipe/Vulkan. Hardware GPU
  passthrough and performance have not been measured.
- Audio tests verify Web Audio transitions and mute behavior; automated runners
  do not assess perceived loudness or sound quality.
- Visual evidence lives in run-private Docker artifact volumes. CDP permits human
  inspection of containerized Chromium but no VNC/noVNC desktop is provided.

## Next action

Publish the P1.4 release-candidate PR and monitor its container-only CI.
