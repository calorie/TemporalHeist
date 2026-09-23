# P4 Player Experience implementation plan

## Stack 1 — UX contract

Add pure presentation and keyboard-decision modules with red tests for identity,
mission steps, prompt range, failure coaching, phase gates, and interactive focus.
Wire them into the HUD and input path without changing existing E2E-visible semantics.

Files: `interaction-decision.ts` is the single canonical-pose/range decision used by
both the prompt and implicit E target (preserving the existing Action terminal and
using the vault's authored radius); `player-experience.ts` derives per-client
identity and three mission steps; `input-contract.ts` owns focus-safe phase gates.
`room-hud.ts`, `main.ts`, and `index.html` render those values. Pure tests cover both
player viewpoints, own/partner Echo labels, exact range boundary, wrong phase,
secured vault, missing player, completed steps, corrective failure copy, repeat keys,
and interactive focus. Run `sh container <run-id> verify`. This layer addresses AC
1, 2, 3, 5, and the failure-copy portion of AC 7.

## Stack 2 — Renderer/readability

Add pure aspect-fit camera calculations and goal-marker primitives with tests, then
integrate them into raw WebGPU. Verify with the focused WebGPU probe in a unique stack.
Keep the existing 1280x720 projection and its camera-sensitive pixel probes compatible;
if framing changes invalidate a probe, update that probe in this layer and run container
acceptance before stacking further work.

## Stack 3 — Browser UX

Add responsive lobby/active layout, semantic labels/live regions, reduced-motion
handling, and a short Chromium UX contract covering real keys, focus, and both target
viewports.

## Stack 4 — Release acceptance

Update the two-client mission assertions for identity, proximity prompt, shared
progress, and terminal restart. Run full verify, acceptance, visual evidence, and the
two-worktree isolation script; record exact evidence in P4 state.
Assert that client A says `YOU · P1` while client B says `YOU · P2`, each names the
other as partner, and canonical Echo ownership produces `YOUR ECHO` on its owner and
`PARTNER ECHO` on the other client.
