# P4 decisions

## 2026-09-23 — Client-only milestone

P4 consumes existing snapshots and map data. It does not change protobuf, authority,
simulation, or map sources. All new cues are presentation-only.

## 2026-09-23 — Target and minimal scope

Target desktop Chromium with keyboard at 1280x720 and 800x600. Optimize first-session
clarity with semantic HUD state, contextual interaction, aspect-safe framing, and
focused browser checks. Defer broader platform and navigation features.

## 2026-09-23 — Review topology

Use four dependent stacked PRs: UX contract, renderer/readability, browser UX
integration, and release acceptance. Every layer must remain compatible with current
main acceptance; only the top release PR requires the long acceptance job.

## 2026-09-23 — Verification shape

Prefer pure Node contract tests and a short containerized Chromium UX test. Keep the
full mission E2E for a few user-visible outcomes and sparse WebGPU probes. Do not add
snapshot-image infrastructure.

## 2026-09-23 — Canonical interaction decision

Use one pure interaction decision for both the visible prompt and implicit E target.
It reads the latest canonical live pose rather than the interpolated render pose,
requires ACTIVE phase, and uses the authored vault radius. Preserve the existing
Action-terminal interaction with its established client range. Authority remains the
final validator, and explicit test API targets remain available for rejection tests.

## 2026-09-23 — Keyboard ownership

Focused interactive/editable DOM elements retain all keys. Global shortcuts consume
movement/action keys only during ACTIVE, Enter only in LOBBY, and R only in terminal
phases. This lets native button keyboard activation send exactly one command while
preventing gameplay keys from scrolling the page.

## 2026-09-23 — Aspect-fit camera and world guidance

Fit the authored map bounds plus 1000 mm of padding into the canvas with one equal
pixels-per-world-unit scale for both axes. This preserves the established horizontal
positions at 1280x720 while keeping the full map visible at both target viewports.
Draw presentation-only cues for the local live player and the canonical current goal:
vault before theft, plate 23 before the final Echo door proof, then extraction. Pass
the local player ID into the renderer; no authority or map contract changes.

## 2026-09-23 — Accessible responsive browser shell

Keep the full briefing available in the lobby and terminal phases inside a bounded,
scrollable HUD, and collapse it only during ACTIVE play. At the two supported desktop
viewports, compact spacing keeps identity, current objective, mission progress, Echo
state, and controls in the viewport. Describe the raw WebGPU canvas as the mission map
and connect it to the semantic identity and objective text. Announce objective and
readiness transitions politely while leaving the per-second timer and Echo countdown
outside live regions. Respect `prefers-reduced-motion` by disabling the HUD transition.

Use a short real-Chromium test inside the existing `verify` entry point for DOM,
focus, reduced-motion, and responsive geometry. This avoids adding dependencies or a
second full mission run; Stack 4 retains ownership of live two-client acceptance.
