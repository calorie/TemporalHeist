# Task 2 — Deterministic guard simulation

## Result

Implemented guard 51's authoritative Patrol → Investigate → Return lifecycle in
`crates/sim/src/lib.rs`. The simulation parses and validates guard map data,
clamps integer movement to waypoints and Echo targets, tests an integer view
cone, fails on a visible connected human, and uses first-generation Echo poses
for non-failing investigation. Search expiry is fixed at arrival plus 180 ticks.
The snapshot publishes guard pose, facing, state, waypoint, optional target, and
timers. Restart resets all guard runtime fields.

## Tests and evidence

All project commands ran via `sh container p2-sim` in a private Compose namespace.
The initial focused guard test run failed to compile because guard map/runtime
fields and validation did not exist. After implementation, the missing-target
recovery test failed with state Investigate and passed after the recovery change.

- `cargo fmt --all --check` — passed.
- `cargo clippy --workspace --all-targets -- -D warnings` — passed.
- `cargo test -p th-sim` — 28 passed, 0 failed; 0 doc tests.

One existing extraction test moved its idle player from `(18000, 4000)` to
`(18000, 2500)` because the newly active guard correctly detects the former
position. The test still exercises Echo-door extraction without entering the
guard's cone.

## Contract concern

The task brief asked for detected-player diagnostics, but frozen `RoomState`
contains only `failure_reason` and `failure_guard_id` for guard failures. The
approved design calls for those fields; no protobuf or map contract was changed.
This is a non-blocking brief overreach rather than a simulation blocker.
