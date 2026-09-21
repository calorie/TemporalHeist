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

1. Inspect current MoQ docs/API and choose compatible stable browser/Rust/relay versions.
2. Establish the minimal TypeScript/Vite + Rust workspace layout.
3. Prove browser ↔ relay and Rust ↔ relay data flow with tiny payloads.
4. Prove WebGPU primitive rendering.
5. Prove Rust/TypeScript protobuf compatibility.
6. Record stable build/test/dev commands in `.agentic/PROJECT.md`.
7. Build the deterministic simulation and Echo semantics with tests before coupling gameplay to networking/rendering.

Agentic Engineering should select delegation, worktrees, and PR topology automatically.

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
