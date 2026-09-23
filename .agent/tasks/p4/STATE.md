# P4 state

## Status

Stack 3 responsive/accessibility browser integration is implemented and verified on
`p4/browser-ux`.

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

## Next action

Commit and publish Stack 3, then extend release acceptance with two-client semantic,
keyboard, responsive, and isolation evidence in Stack 4.
