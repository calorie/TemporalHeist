# P5 WebGPU Temporal Identity

## Goal

Make raw WebGPU essential to Temporal Heist's core fantasy by visualizing the exact
canonical ten-second relationship between each live player and their Echo.

## Scope

- Derive a presentation-only Temporal Bridge from canonical Timeline samples over
  `[renderTick - 600, renderTick]` for each player.
- Render that trajectory through a dedicated WebGPU/WGSL ribbon pipeline.
- Preserve P1 cyan and P2 magenta ownership with tail-to-head age gradients,
  soft edges, and one-second temporal knots.
- Render a canonical-tick-driven procedural spawn ring for the first 60 ticks after
  an Echo becomes available.
- Keep authority, protocol, MoQ, map, collision, and gameplay unchanged.

## Acceptance criteria

1. A bridge contains only canonical samples between source Echo tick and current
   human tick, with endpoints exactly 600 ticks apart when sufficient history exists.
2. Missing players/discontinuities split or omit segments rather than drawing false
   connections; epoch reset removes all prior bridges and pulses.
3. Two players remain visually distinct through cyan/magenta ownership and Echoes
   remain structurally distinct from opaque humans.
4. JS uploads bounded segment data (fixed capacity 512; normal two-player 20 Hz
   interpolation is at most 402 segments) while WGSL expands segments into ribbons and
   computes taper, edge falloff, temporal gradient, knots, and spawn ring pixels.
5. Persistent GPU buffers are allocated at renderer creation and reused. Capacity,
   upload bytes, segment count, pulse count, and draw count are observable; overflow
   fails explicitly.
6. Opaque geometry renders first; temporal transparency uses depth testing with
   depth writes disabled so walls and doors occlude the bridge.
7. Container Chromium pixel probes prove recent/old/outside colors, pulse boundaries,
   both owner palettes, and zero shader/validation errors at 1280x720 and 800x600.
8. Full two-client mission evidence proves both clients agree on canonical bridge
   endpoints, 600-tick delta, and trail counts during Echo gameplay.
9. Existing gameplay, transport, responsive UX, screenshots, restart, reconnect,
   and two-stack isolation remain green.
10. Redundant standalone GPU spike is removed only after its adapter/backend and
    validation evidence is covered by the production renderer GPU test.

## Continuity contract

- A bridge exists only during an ACTIVE room attempt and is keyed by
  `(room_epoch, room.attempt)`.
- Adjacent canonical samples may connect only when they are at most three authority
  ticks apart and contain the same player identity.
- Spawn pulses begin at the authoritative snapshot where an Echo changes from absent
  to present in the same attempt. A first retained sample that already contains an
  Echo does not invent a pulse.

## Out of scope

Bloom, full-screen distortion, compute particles, MSAA, future-path prediction,
new assets, gameplay effects, and hardware-GPU-specific behavior.
