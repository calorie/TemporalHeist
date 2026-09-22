# P2 state

## Status

The P2 protocol and authored map contract are frozen and container-verified.
Deterministic guard simulation is next.

## Completed

- Selected an authority-owned Patrol → Investigate → Return guard state machine.
- Defined live-human failure and non-failing Echo investigation semantics.
- Preserved the exact 600-tick, one-generation canonical Echo model.
- Defined the contract-first and container-only verification boundaries.
- Added additive protocol-major-1 fields: `Snapshot.guards = 12` and
  `RoomState.failure_guard_id = 11`.
- Added `FailureReason.GUARD = 3`, `GuardState` values Unspecified/Patrol/
  Investigate/Return = 0/1/2/3, and the `Guard`/`GuardTarget` messages.
- Authored guard 51 with waypoints 511 then 512 and the guarded-passage rectangle,
  and regenerated the TypeScript bindings from the protobuf source.
- Added a Rust-to-TypeScript protocol spike covering all three operational guard
  states, optional investigation target presence, guard failure diagnostics, and
  legacy snapshots that omit field 12.
- Updated existing Rust snapshot construction for additive compatibility; guard
  simulation remains intentionally empty until the next implementation task.

## Verification

All commands ran in the isolated `p2-contract` container namespace.

- `sh container p2-contract build dev` — passed.
- `sh container p2-contract run --rm dev npm ci` — passed; 41 packages installed,
  0 vulnerabilities.
- `sh container p2-contract run --rm dev sh containers/codegen.sh` — passed.
- `sh container p2-contract run --rm dev sh spikes/protocol/check.sh` — passed;
  Rust/TypeScript guard round-trip and absent-field compatibility assertions passed.
- `sh container p2-contract run --rm dev cargo fmt --all --check` — passed.
- `sh container p2-contract run --rm dev cargo fmt --manifest-path spikes/protocol/Cargo.toml -- --check` — passed.
- `sh container p2-contract run --rm dev cargo test --workspace` — passed; 25 tests,
  0 failures, plus all doc tests.
- `sh container p2-contract run --rm dev npx tsc -p apps/web/tsconfig.json` — passed.

TDD evidence: before the protobuf production change, the protocol command failed
because generated TypeScript did not export `GuardState`. The first attempt on the
fresh run ID stopped earlier because its isolated Node volume had not yet received
`npm ci`; after installing locked dependencies, the expected missing-contract
failure was observed.

## Blockers

None.

## Next action

Rebase dependent worktrees onto this contract commit, then implement and
container-verify deterministic guard simulation.
