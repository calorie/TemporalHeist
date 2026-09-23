# P4 Player Experience design

P4 makes the existing mission legible on first play while leaving gameplay authority
unchanged. The browser derives a small presentation model from canonical snapshots,
the local player ID, and authored map data. That model owns player identity, mission
steps, contextual action copy, failure coaching, and lobby/active display mode.

The active HUD replaces the permanent briefing with a compact three-step mission
display. The briefing remains available in lobby and terminal phases. Local identity
uses the renderer's existing player colors and explicitly explains the translucent
Echo form. The nearest valid action target produces a named prompt only inside the
same authored range used to choose the outgoing target ID.

Keyboard handling ignores gameplay shortcuts from interactive/editable elements,
prevents browser defaults for consumed keys, and gates room commands by the current
presentation phase. Losing focus continues to send a neutral motion input.

The renderer computes an aspect-safe camera transform from viewport size and emits
presentation-only markers for the local player and current goal/action target. These
primitives never affect collision or authority state. Responsive CSS keeps the lobby
instructions scrollable and collapses them during active play.

Verification uses pure contract tests first, one short containerized Chromium test
for actual keyboard/focus/ARIA/layout behavior, and the existing full mission E2E for
shared progress. Raw WebGPU is probed at desktop and compact viewport sizes. All
commands use unique Compose namespaces and run in containers.

