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

### A11 — Container-only project execution

**Decision:** every project build, codegen, run, test, lint, typecheck, relay, authority, web-server, browser, and WebGPU verification process runs inside containers.

The host is not part of the application toolchain. It may provide Git, Codex/agent tooling, and the container runtime/orchestrator. A host-native test result is not accepted verification evidence.

**Rationale:** eliminates host drift, makes agent environments reproducible, and lets CI exercise the same execution path as local agents.

### A12 — Per-agent runtime isolation

**Decision:** each concurrent agent uses an isolated worktree/checkout and an independently namespaced container stack, including its own network, writable volumes/caches, relay, authority, test data, certificates, browser profile, and test artifacts.

Automated tests must not require fixed host ports or hard-coded container names. A stack teardown must never affect another agent.

**Rationale:** agents must be able to implement and verify concurrently without serializing on shared runtime infrastructure.

### A13 — Contract-first parallel implementation

**Decision:** shared source-of-truth contracts such as protobuf schemas are explicit synchronization boundaries. Establish/freeze the minimum viable contract before a parallel implementation wave. After that, components must build/test independently from the checked-out contract. Contract changes are serialized and versioned/verified before parallel work resumes.

**Rationale:** true parallel writes cannot safely mutate a shared schema simultaneously; isolating that narrow synchronization boundary maximizes parallel implementation everywhere else without creating integration ambiguity.

### A14 — Containerized browser/WebGPU verification

**Decision:** Chromium used for E2E, manual acceptance, and WebGPU smoke tests runs inside a container. Use a verified software GPU/Vulkan implementation or container GPU passthrough; do not fall back to host Chromium as the acceptance path.

## Reversible choices delegated to Codex

### A15 — Verified transport and browser baseline

Selected `@moq/net` 0.3.5, `moq-net` 0.2.22, `moq-native` 0.19.19 and
`moq-relay` 0.14.18. The container spike verified WebTransport with `moq-lite-05`,
two concurrent browser publishers, Rust replies, and real group fetch. Explicit
30-second track/subscriber latency is required instead of the five-second default.
Use bounded authority-origin history bootstrap for gameplay late join so correctness
does not rely on relay retention. Keep protocol types outside transport adapters.

### A16 — Software WebGPU validation

Full containerized Chromium 153.0.8010.12 from Playwright 1.63.0 initializes a
Google SwiftShader fallback WebGPU adapter. Explicit ANGLE/Vulkan/SwiftShader
flags are recorded in `spikes/gpu/test.mjs`; WGSL compilation, GPU pixel readback
and validation checks pass. The compositor separately reports Mesa llvmpipe.
No host browser or GPU-derived authority is used.

### A17 — Generated protocol bindings

Use prost/prost-build 0.14.4 for Rust and ts-proto 2.12.4 for TypeScript, generated
from one protobuf schema. Container compatibility test includes negative axes and
JavaScript's maximum safe integer. P0 rejects values outside safe wire limits.
Protocol major, epoch, session and per-kind input sequences define compatibility
and idempotency; no zero/unknown input kind is interpreted as join.

### A18 — Final replication and verification shape

Authority simulation runs at 60 Hz and publishes independently decodable full
snapshots at 20 Hz. E2E permits up to two ticks of observation latency at a Presence
transition while still requiring every Echo pose to identify the exact canonical
`source_tick = server_tick - 600`. Deterministic simulation tests own the exact
per-tick `T + 600` assertion.

The root `container` wrapper is the local and CI contract. `verify` runs all static,
protocol, unit, and production-build checks. `acceptance` prebuilds authority into
the run-private target volume before launching services, preventing a clean-cache
compile from racing the browser join timeout.

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
- development process topology, subagent count, worktrees, and PR shape;
- exact OCI base images and Dockerfiles;
- Docker Compose file decomposition and helper command names;
- software WebGPU implementation versus available GPU passthrough, provided Chromium itself remains containerized;
- cache implementation, provided writable state is isolated across concurrent agents.

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
- world not rewinding with the Echo;
- container-only project execution and verification;
- per-agent isolated runtime stacks suitable for concurrent implementation/testing.

Do not ask for input merely because an API/tooling choice is uncertain; investigate and choose the least-complex verified path instead.
