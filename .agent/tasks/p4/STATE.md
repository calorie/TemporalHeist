# P4 state

## Status

Stack 1 UX/input contract is implemented and verified on `p4/ux-contract`.

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

## Next action

Commit and publish Stack 1, then build aspect-safe camera and world cues in Stack 2.
