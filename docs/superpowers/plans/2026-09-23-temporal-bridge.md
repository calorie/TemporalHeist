# WebGPU Temporal Bridge implementation plan

## Stack 1 — Temporal model

Expose bounded canonical trajectory sampling from Timeline and generate owner-separated
segments plus spawn-pulse state in a pure temporal view. Cover exact 600-tick endpoints,
interpolation, gaps, two players, late history, capacity, and epoch reset in container
Node tests. Run full component verification.

Continuity is scoped to one ACTIVE `(room_epoch, room.attempt)`. Pulse timing comes
from authoritative Echo absent-to-present transitions. Allocate for 512 records;
normal endpoint interpolation can produce 402 records for two players.

## Stack 2 — GPU renderer

Add persistent segment/pulse buffers and a dedicated WGSL module/pipeline. Render the
opaque scene first and transparent bridge second. Extend the existing production
renderer GPU test for temporal pixels, both viewports, stats, capacity, and validation.
Run verify and existing acceptance in the layer that changes screenshots.

## Stack 3 — Release evidence

Assert bridge endpoint/source/current tick agreement on both clients at an existing
Echo scene, record renderer stats, consolidate the standalone GPU spike into the
production renderer test, then run verify, acceptance, visual evidence, and two-stack
isolation. Record exact commands and backend evidence in P5 state.
