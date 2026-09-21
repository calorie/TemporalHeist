# Vertical slice state

## Status

Ready for implementation.

The repository currently contains only the agentic project template plus the design/task bootstrap. No application code or application toolchain has been created yet.

## Completed

- Product decisions D1–D6 confirmed by the user.
- Default architecture direction captured for Rust authority, Chromium-first browser client, raw WebGPU, MoQ adapters, and protobuf.
- Echo gameplay semantics fixed for P0.
- Authority/timeline/transport boundaries documented.
- End-to-end acceptance scene and verification requirements documented.
- Container-only execution and per-agent runtime-isolation requirements confirmed by the user and documented.

## Verified external baseline at task creation

Checked on 2026-09-21 against the current `moq-dev/moq` repository:

- `@moq/net` exists as the TypeScript/browser networking package.
- `moq-net` exists as the Rust networking crate.
- `moq-relay` exists as the relay binary/crate.
- the project describes `moq-lite` as a generic pub/sub transport and states that `moq-net` negotiates `moq-lite` or IETF `moq-transport`.

Versions change quickly; re-check latest stable compatible versions immediately before adding dependencies.

## Next action

Execute the vertical-slice task from `SPEC.md` end-to-end.

Start with narrow environment/bootstrap spikes rather than speculative full implementation:

1. Bootstrap a container-first development/test environment; do not install or execute the application toolchain on the host.
2. Define per-agent Compose/project namespacing and prove two isolated stacks can coexist without port/network/volume collisions.
3. Inspect current MoQ docs/API from the containerized toolchain and choose compatible stable browser/Rust/relay versions.
4. Establish the minimal TypeScript/Vite + Rust workspace layout inside the container contract.
5. Prove browser ↔ relay and Rust ↔ relay data flow with tiny payloads, entirely inside a per-agent container stack.
6. Prove containerized Chromium WebGPU primitive rendering.
7. Prove Rust/TypeScript protobuf compatibility using containerized codegen/tests.
8. Freeze the minimal shared protocol/interfaces needed for a parallel implementation wave.
9. Record stable containerized build/test/dev commands in `.agentic/PROJECT.md`.
10. Build the deterministic simulation and Echo semantics with tests before coupling gameplay to networking/rendering.

Agentic Engineering should select delegation, worktrees, and PR topology automatically. Parallel writing agents must receive disjoint worktrees/ownership and independently namespaced container stacks. Shared contract edits must be serialized as the narrow synchronization boundary.

## Current blockers

None known.

## Verification status

Design bootstrap only. No application tests exist yet.

## State maintenance

Update this file at meaningful milestones with:

- implemented slices;
- exact verification commands and outcomes;
- integration blockers;
- deviations from the design and links/rationale recorded in `DECISIONS.md`;
- the next concrete action.
