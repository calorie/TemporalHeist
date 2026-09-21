# Vertical slice decisions

These decisions are durable for the active vertical slice. Reversible implementation details do not require user approval. Product-semantic changes do.

## Confirmed product decisions

### D1 — View and movement

**Decision:** top-down 2.5D. Render in 3D; MVP gameplay movement is planar.

**Rationale:** makes multiplayer prediction/collision and puzzle readability substantially simpler while preserving a strong WebGPU presentation surface.

### D2 — Echo trajectory vs current physics

**Decision:** current-world collision does not modify an Echo trajectory.

**Rationale:** the player's recorded plan must replay predictably even if a door has since closed or other current-world geometry changed. Echo is a projection of committed history, not a second re-simulation of historical input in today's world.

### D3 — Echo interaction capabilities

**Decision:** P0 supports `None`, `Presence`, and `Action`. No Echo physical pushing/carrying.

**Rationale:** these capabilities are sufficient for time-coordination puzzles without coupling historical replay to unstable rigid-body state.

### D4 — Player count

**Decision:** two players in the vertical slice. The architecture should not gratuitously prevent a later four-player target.

### D5 — Echo delay/generation

**Decision:** exactly one Echo generation at 10 seconds for P0.

At 60 Hz authority time, the fixed delay is 600 ticks.

### D6 — Renderer

**Decision:** raw WebGPU + WGSL. No game engine owns rendering.

**Rationale:** WebGPU is a primary technical objective, not an implementation detail hidden behind an engine.

## Architecture decisions adopted as P0 defaults

### A1 — Authority

**Decision:** Rust server is authoritative for movement, collision, interactions, door/plate state, and Echo gameplay effects.

Clients send intents and render replicated canonical state.

### A2 — Canonical time

**Decision:** `(room_epoch, server_tick)` is canonical. Fixed logical room simulation is 60 Hz.

Browser wall clocks are presentation/input clocks only.

### A3 — Canonical history vs network timeline

**Decision:** authority retains 60 Hz committed history for gameplay Echo evaluation. Network timeline snapshots may be sampled at a lower rate (initially about 20 Hz) for rendering/transfer.

Discrete accepted actions are retained separately/alongside history so lower pose sample rate cannot lose action semantics.

### A4 — Echo recursion

**Decision:** Echo effects never enter the original human source timeline. Every Echo generation, including possible future generations, derives from original human history.

### A5 — Echo Action replay

**Decision:** if a human action was accepted at tick `T` against an Echo-Action-capable stable target, the authority emits one Echo Action pulse to that target at `T + 600`.

The replay does not re-run historical path/collision/proximity validation. The target's current state machine consumes the pulse. Avoid generic toggle semantics.

### A6 — Transport

**Decision:** use `moq-dev/moq` and a real `moq-relay` for the application data plane. Isolate MoQ behind adapters.

Do not hand-roll IETF MOQT wire protocol. Do not silently replace the accepted path with application WebSockets.

### A7 — Protocol

**Decision:** Protocol Buffers are the default cross-language application schema. Authoritative coordinates should prefer integer units such as millimetres/milliradians.

The protobuf runtime/generator is reversible and should be selected during bootstrap.

### A8 — Browser target

**Decision:** current desktop Chromium first.

Cross-browser support is not a P0 blocker.

### A9 — Persistence/auth

**Decision:** no accounts, durable database, or production auth for P0.

### A10 — Art

**Decision:** primitive/procedural geometry is sufficient for the vertical slice. Do not block network/gameplay proof on an asset pipeline.

## Reversible choices delegated to Codex

Codex may choose and later revise without asking the user:

- exact workspace/package-manager layout;
- Vite configuration;
- Rust async/runtime and internal crate boundaries, provided the domain/transport boundary remains clean;
- protobuf generator/runtime;
- unit/integration/E2E test frameworks;
- exact MoQ version and adapter API after compatibility verification;
- initial reliable vs unreliable mapping for motion data;
- ECS vs simple structs;
- math library;
- shader organization;
- development process topology, subagent count, worktrees, and PR shape.

Record a new decision here when a reversible choice becomes a durable repository constraint.

## Product decisions that require explicit user input before changing

- top-down 2.5D baseline;
- collision-independent Echo trajectory;
- P0 Echo interaction capability model;
- two-player P0 acceptance target;
- 10-second single-generation Echo;
- raw WebGPU requirement;
- server-authoritative gameplay;
- MoQ as the actual realtime data plane;
- world not rewinding with the Echo.

Do not ask for input merely because an API/tooling choice is uncertain; investigate and choose the least-complex verified path instead.
