# Project-specific context

## Build / test / lint / typecheck

No application toolchain has been bootstrapped yet. The active `vertical-slice` task owns bootstrap. Once commands are verified, record the stable commands here.

## Dependency / toolchain

- Client language: TypeScript.
- Client bundler/dev server direction: Vite unless a concrete compatibility issue requires a different minimal choice.
- Renderer: raw WebGPU and WGSL. Do not introduce a game engine or rendering framework that owns the render loop.
- Authority language: Rust using the stable toolchain and Rust 2024 edition where supported by selected dependencies.
- Realtime transport direction: `moq-dev/moq`; browser side uses `@moq/net`, native side uses `moq-net`, and local development uses `moq-relay`.
- Protocol serialization direction: Protocol Buffers. Generator/runtime choices are reversible implementation details and may be selected autonomously.
- Initial browser target: current desktop Chromium with WebGPU and WebTransport support.
- All project build, code generation, run, lint, typecheck, test, integration, E2E, relay, authority, web-server, and Chromium processes must execute inside OCI containers. Do not execute project toolchains directly on the host.
- Docker Compose is the default local orchestration interface unless an equivalent container workflow demonstrably preserves the same isolation and reproducibility.
- The host is only an orchestration surface for Git, Codex/agent runtime, and the container runtime; host-installed Node, Rust, protobuf, MoQ, browsers, or test runners are never required for project correctness.
- Prefer the latest stable compatible dependencies at implementation time; do not copy dependency versions from design prose without re-checking them.

## Architecture invariants

- The Rust authority owns all gameplay state and all gameplay outcomes.
- Canonical game time is `(room_epoch, server_tick)`, never browser wall-clock time.
- The room simulation runs at a fixed 60 Hz logical tick.
- A player's canonical simulation history is immutable after a tick is committed.
- Echoes derive only from the original human player's canonical timeline. Echo actions are never recorded into that source timeline, so there is no Echo-of-Echo recursion.
- The MVP has exactly one Echo generation at a fixed delay of 600 server ticks (10 seconds).
- An Echo replays the committed historical trajectory. Current-world collision never changes, blocks, or redirects that trajectory.
- Echo gameplay effects are evaluated by the authority server, never by renderer output or client claims.
- MVP Echo interaction capabilities are `None`, `Presence`, and `Action`. Physical pushing/carrying is out of scope.
- A replayed Echo Action is a delayed pulse to the same stable target identifier after the original action was accepted. It is not a generic `toggle`; target-specific current-world state machines consume the pulse.
- Renderer output and WebGPU computation must never be a source of authoritative gameplay state.
- Game/domain code must not import MoQ implementation types directly. MoQ is contained behind client/server transport adapters.
- The authority's internal 60 Hz history is the source for Echo gameplay. Network timeline sampling may be lower rate and is for replication/rendering/history transfer.
- Published timeline chunks/groups must be independently decodable; do not require an unbounded prior delta chain.
- Client prediction may improve local feel but never changes authority semantics.
- Container-only execution is an architecture invariant: a verification result obtained only from a host-native project process is not accepted evidence.
- Parallel agents must use isolated Git worktrees/checkouts and isolated container stacks. No two agents may share mutable containers, Docker networks, named volumes, caches that permit writes across agents, databases, relays, authority processes, or browser test processes.
- Every agent stack must be namespaced by a unique agent/run identifier (for example via `COMPOSE_PROJECT_NAME`), must avoid hard-coded `container_name`, and must avoid fixed host ports in automated tests.
- Shared schemas and generated-code sources of truth are synchronization boundaries. Freeze or version the minimum shared contract first; after that, component implementation must be independently buildable and testable from the checked-out contract without another agent's running environment.
- The complete integration/E2E stack must itself be reproducible per agent, so multiple agents can run equivalent full-stack tests concurrently without resource-name or port collisions.

## Generated code / source of truth

- When the protocol schema is added, the `.proto` files are the source of truth for generated Rust/TypeScript message code.
- Generated protocol bindings must not be hand-edited.
- Keep gameplay constants that affect authority semantics in a single source of truth or verify mirrored constants with tests.

## External constraints

- MoQ and its IETF transport are evolving. Keep protocol/library adaptation at explicit boundaries and verify current APIs before implementation.
- The project intentionally uses MoQ as the game data plane, not merely for spectator video.
- The vertical slice must run through `moq-relay`; replacing MoQ with WebSocket-only application messaging does not satisfy acceptance.
- No login, durable persistence, voice chat, mobile support, or production deployment is required for the first vertical slice.
- The repository's agent infrastructure and `README.md` must remain English to satisfy the existing `agentic-contract` workflow.
- Container images/configuration are part of the reproducible development contract. CI should invoke the same containerized entry points used locally rather than reimplementing host-native build/test logic.
