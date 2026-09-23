# P4 state

## Status

P4 Player Experience is complete on `p4/release-acceptance`. All acceptance
criteria are implemented and verified entirely through containers.

## Review stack

1. `p4/ux-contract` — semantic UX model and safe input contract.
2. `p4/renderer-readability` — aspect-safe camera and world cues.
3. `p4/browser-ux` — responsive/accessibility browser integration.
4. `p4/release-acceptance` — two-client mission and isolation evidence.

## Audit findings

- Players cannot reliably identify self, partner, Echo, or the current world target.
- The global objective lacks proximity feedback and out-of-range actions fail silently.
- The eight-line briefing obscures active play and clips on short viewports.
- Global shortcuts fire while controls have focus.
- The fixed whole-map camera crops or shrinks content across aspect ratios.
- Existing acceptance is strong for gameplay but does not exercise real keys, focus,
  responsive layout, or semantic accessibility.

## Verification

- `sh container p4-contract-agent verify` passed on 2026-09-23: Rust format,
  clippy and 47 tests; protobuf compatibility; TypeScript typecheck; Biome;
  all browser/presentation contracts; Vite production build; containerized raw
  WebGPU on Chromium 153 using Mesa llvmpipe plus SwiftShader fallback adapter.
- `sh container p4-contract-agent acceptance` passed the complete two-client P3
  mission, restart/failure cycles, MoQ transport, shared authority results, and raw
  WebGPU with no browser or renderer errors.
- New pure tests cover P1/P2 identity, own/partner Echo labels, three mission-step
  transitions, canonical vault range boundaries, phase/secured/missing-player gates,
  preserved Action-terminal selection, corrective failure copy, key repeats, and
  interactive focus ownership.
- Review fixes remove the persistent `[E]` objective hint so only the canonical
  range-gated prompt advertises interaction, mark all mission steps complete in WON,
  and cache semantic HUD values so stable animation frames retain existing DOM nodes.
  Focused container tests, TypeScript, Biome, and the production build pass for these
  corrections.
- `sh container p4-renderer-agent verify` passed on 2026-09-23 after adding the
  aspect-fit camera, local-player marker, canonical mission-goal marker, and updated
  GPU/screenshot probes. It covered Rust format/clippy/47 tests, TypeScript, Biome,
  pure presentation contracts, production build, and raw WebGPU on Chromium 153
  with Mesa llvmpipe plus the SwiftShader fallback adapter.
- `sh container p4-renderer-agent acceptance` passed the complete two-client mission,
  vault theft, Echo door, extraction, restart/failure cycles, updated rendered-pixel
  probes, screenshots, MoQ transport, and shared authority results with no browser or
  renderer errors.
- The first camera acceptance runs rejected stale screenshot probes: the floor/wall
  coordinates and guard-body height still encoded the old unequal vertical scale,
  and the vault-center color still expected the pedestal instead of the new goal cue.
  The probes now derive from the equal-scale projection and retain their regression
  checks; the corrected full acceptance passed.
- Review correction gates the enlarged yellow vault-action cue on canonical ACTIVE
  phase as well as range and unsecured objective state. Pure tests cover ACTIVE,
  LOBBY, FAILED, and WON; the focused presentation test, TypeScript, and Biome pass
  in `p4-renderer-agent` containers.
- `sh container p4-browser-agent verify` passed on 2026-09-23. It includes all Rust,
  protocol, TypeScript, Biome, browser contract, production build, and raw WebGPU
  checks plus a short containerized Chromium UX test at 1280x720 and 800x600.
- The Chromium UX test verifies viewport-safe ACTIVE HUD geometry, lobby/terminal
  scrolling, ACTIVE briefing collapse, terminal briefing restoration, reduced-motion
  styling, canvas/HUD/identity/objective/readiness semantics, and native Enter on the
  focused mute button without leaking into the global ready shortcut.
- WebGPU evidence remained clean in Chromium 153: Mesa Vulkan llvmpipe hosted ANGLE
  and the WebGPU fallback adapter reported SwiftShader with zero shader or validation
  errors.
- Review follow-up removed the redundant JavaScript `hidden` mutation so
  `data-phase` CSS is the single briefing lifecycle mechanism. The Chromium check now
  asserts that contract directly, fills every critical ACTIVE HUD field with
  representative worst-case text, and proves all fields are visible, viewport-bound,
  and vertically non-overlapping at both target sizes. It also observes the real
  focused Enter event (`defaultPrevented: false`) and exactly one native mute click.
- `sh container p4-release-agent-verify verify` passed on 2026-09-23. It covered
  Rust format, clippy and 47 tests; protobuf compatibility; TypeScript; Biome;
  browser/presentation contracts; Vite production build; responsive Chromium at
  1280x720 and 800x600; and raw WebGPU. Chromium 153 used Mesa Vulkan llvmpipe,
  while the WebGPU adapter reported Google SwiftShader with no validation errors.
- `sh container p4-release-agent-acceptance acceptance` passed at `1c3cd60`.
  Both clients proved their local/partner identity, lobby briefing visibility and
  ACTIVE collapse, canonical mission-step transitions, range-gated vault prompt,
  actual browser `D` movement and `E` theft, shared vault/Echo-door/extraction
  progress, all-complete WON state, corrective guard/camera failure messages,
  restart cleanup, MoQ reconnect, and raw WebGPU with no browser/renderer errors.
- The full mission recorded P1 keyboard movement from x=1500 to x=1620 and secured
  the vault through the visible `E · STEAL VAULT DATA` prompt. Out-of-range UI and
  authority rejection were both observed before the successful action.
- The final two-worktree isolation command passed at `1c3cd60`:
  `sh containers/verify-two-stack-isolation.sh /Users/a/TemporalHeist/.worktrees/p4-release p4-release-agent-iso-a /tmp/temporal-heist-p4-release-equivalent p4-release-agent-iso-b /tmp/temporal-heist-p4-release-isolation`.
  Both production acceptance runs exited 0 while their browsers were live
  concurrently. Container, network, volume, room, certificate/test data, and
  browser profiles were independently namespaced; neither stack published host
  ports. Removing Stack A with volumes preserved Stack B's exact resource IDs and
  its web health check passed. Machine-readable evidence and both acceptance logs
  are in `/tmp/temporal-heist-p4-release-isolation/`.

## Known constraints and unverified items

- P4 intentionally targets desktop Chromium with keyboard at 1280x720 and 800x600.
  Gamepad, touch/mobile, remapping, localization, voiceover, minimap/pathfinding,
  and image-diff regression testing remain outside this milestone.
- GPU evidence is from container software rendering (Mesa llvmpipe and SwiftShader),
  not a hardware GPU passthrough path.

## Next action

Publish Stack 4 for review. After merge, begin P5 Release Candidate work from the
merged P4 baseline: release packaging, production configuration, observability,
fresh-machine bootstrap verification, and a final performance/reliability pass.
