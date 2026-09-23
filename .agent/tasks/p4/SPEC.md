# P4 Player Experience

## Goal

Make the complete two-player vault heist understandable and operable on a first
play in desktop Chromium with a keyboard, without changing authoritative gameplay.

## Scope

- Identify the local player, partner, and Echoes consistently in the HUD and scene.
- Present authority-derived mission progress: steal data, open the final door with
  Echo Presence, then extract together.
- Show a contextual action prompt only while the local live player can use a target.
- Keep lobby instructions available without covering active play.
- Make keyboard input safe around focused controls and browser defaults.
- Keep the HUD and world readable at 1280x720 and 800x600.
- Provide actionable success and failure feedback with accessible DOM semantics.
- Preserve raw WebGPU rendering and container-only verification.

## Acceptance criteria

1. Each client labels its own live player, partner, and Echo appearance correctly.
2. The active HUD shows one current mission step and completed prior steps, derived
   only from canonical snapshots.
3. The vault prompt appears only when the local human is in valid interaction range;
   an out-of-range action gives no success indication.
4. The lobby briefing collapses during ACTIVE while controls, objective, timer, Echo
   timing, guard state, and current interaction remain readable at both target sizes.
5. Enter on a focused control does not also trigger a global room command; consumed
   movement/action keys prevent browser defaults, and blur still releases movement.
6. Current goals and actionable targets have non-authoritative WebGPU cues. Camera
   framing remains aspect-safe at both target sizes.
7. Failure messages describe the hazard and a corrective action; audio contains no
   information absent from the visual UI.
8. Containerized Chromium proves real keyboard/focus behavior, ARIA/layout, and raw
   WebGPU at both target sizes.
9. The two-client full mission proves shared progress through theft, Echo door, and
   extraction, then restart. Existing transport and gameplay acceptance remains green.
10. Two isolated full stacks can run concurrently and survive deletion of the other.

## Out of scope

Gamepad, touch/mobile, remapping, localization, voiceover, minimap/pathfinding,
new gameplay/protocol/map state, and an image-diff framework.

