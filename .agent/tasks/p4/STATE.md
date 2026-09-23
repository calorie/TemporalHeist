# P4 state

## Status

Stack 2 renderer/readability is implemented and verified on `p4/renderer-readability`.

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

## Next action

Commit and publish Stack 2, then build responsive and accessible browser integration
in Stack 3.
