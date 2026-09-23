# Guard and Echo Stealth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one deterministic patrol guard that catches live humans, investigates a ten-second Echo decoy, and creates a verified cooperative crossing window.

**Architecture:** Freeze one additive protobuf/map contract, then implement guard gameplay in the pure Rust simulation and guard presentation in the browser behind that contract. The existing authority snapshot/MoQ path transports the new state without a second data plane; raw WebGPU renders it, and the existing two-client runner proves the authored solution.

**Tech Stack:** Rust 1.98.1, prost/protobuf, TypeScript 7, raw WebGPU/WGSL, MoQ, containerized Chromium/Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-23-guard-echo-stealth-design.md`

## Global Constraints

- Every build, generator, application process, browser, and test runs through the repository's container entry points.
- Authority simulation remains 60 Hz with canonical `(room_epoch, server_tick)` time.
- Echo delay remains exactly 600 ticks, one generation, sourced only from canonical human history, and unaffected by current collision.
- Live-human guard detection fails the attempt; Echo observation only causes investigation; human detection wins on the same tick.
- Gameplay and guard AI remain server-authoritative; WebGPU output never affects gameplay.
- MoQ remains the sole realtime application data plane and domain code remains independent of MoQ library types.
- Parallel writers use distinct worktrees, run IDs, Compose projects, networks, writable volumes, services, browser profiles, certificates, logs, and artifacts.
- `proto/temporal_heist.proto`, generated-code rules, map semantics, and container commands are serialized synchronization boundaries.

## Review Focus

- A human and Echo visible on the same tick must fail for the human before any investigation transition; Task 2 adds this exact test.
- Continuous visibility of one Echo must not refresh the search deadline forever; Task 2 tests a visibility interval longer than the search duration.
- A guard reaching a target by a non-divisible step distance must clamp exactly rather than oscillate; Task 2 tests a 25 mm target with a 20 mm step.
- Old or partially populated protocol-major-1 snapshots must render safely with no guards; Tasks 1 and 3 test absent additive fields.
- Restart from a guard failure must restore initial pose, patrol index, state, timers, and observation key; Task 2 tests the complete reset state.

---

### Task 1: Freeze the guard protocol and map contract

**Files:**
- Modify: `proto/temporal_heist.proto`
- Modify: `map/facility.json`
- Regenerate: `apps/web/src/generated/temporal_heist.ts`
- Modify: `spikes/protocol/src/main.rs`
- Modify: `spikes/protocol/check.mjs`
- Test: `crates/authority/src/lib.rs`
- Modify: `.agent/tasks/p2/STATE.md`
- Modify: `.agent/tasks/p2/DECISIONS.md`

**Interfaces:**
- Produces: protobuf `GuardState`, `Guard`, `Snapshot.guards`, `FailureReason.GUARD`, and `RoomState.failure_guard_id`.
- Produces: map `guards[]` entries with `id`, initial pose, movement/view parameters, search ticks, and ordered waypoint objects.
- Consumes: existing protocol-major-1 additive compatibility and `containers/codegen.sh`.

- [ ] **Step 1: Add failing cross-language protocol assertions**

Extend the Rust spike snapshot with a guard and the TypeScript checker with these assertions:

```ts
assert.equal(snapshot.guards[0]?.id, 51);
assert.equal(snapshot.guards[0]?.state, GuardState.INVESTIGATE);
assert.equal(snapshot.guards[0]?.investigationTarget?.xMm, 18750);
assert.equal(snapshot.room?.failureReason, FailureReason.GUARD);
assert.equal(snapshot.room?.failureGuardId, 51);
```

Also decode a snapshot encoded without field 12 and assert `snapshot.guards` is an empty array.

- [ ] **Step 2: Run the protocol spike and verify it fails**

Run: `sh container p2-contract run --rm dev sh spikes/protocol/check.sh`

Expected: TypeScript or Rust compilation fails because the guard types and fields do not exist.

- [ ] **Step 3: Add the additive protobuf contract**

Append the snapshot field and types without renumbering existing fields:

```proto
message Snapshot {
  // existing fields 1..11 unchanged
  repeated Guard guards = 12;
}
enum GuardState {
  GUARD_STATE_UNSPECIFIED = 0;
  PATROL = 1;
  INVESTIGATE = 2;
  RETURN = 3;
}
message Guard {
  uint32 id = 1;
  sint32 x_mm = 2;
  sint32 z_mm = 3;
  sint32 facing_x = 4;
  sint32 facing_z = 5;
  GuardState state = 6;
  uint32 waypoint_id = 7;
  GuardTarget investigation_target = 8;
  uint64 state_entered_tick = 9;
  uint64 search_expires_tick = 10;
}
message GuardTarget { sint32 x_mm = 1; sint32 z_mm = 2; }
```

Add `GUARD = 3` to `FailureReason` and `uint32 failure_guard_id = 11` to `RoomState`.

- [ ] **Step 4: Add one authored map encounter**

Add guard 51 with a 20 mm/tick speed, 2600 mm view range, 1400 mm half-width,
180 search ticks, initial position `(17200, 4000)`, and cyclic waypoint IDs 511
at `(17200, 4000)` and 512 at `(20500, 4000)`. Keep waypoint IDs and route order
explicit in JSON. Add a `guardedPassage` rectangle covering the authored crossing
used by E2E; do not add a navigation mesh.

- [ ] **Step 5: Generate bindings and make both language assertions pass**

Run:

```sh
sh container p2-contract build dev
sh container p2-contract run --rm dev npm ci
sh container p2-contract run --rm dev sh containers/codegen.sh
sh container p2-contract run --rm dev sh spikes/protocol/check.sh
```

Expected: Rust encodes and TypeScript decodes every guard state and the guard failure; absent guard fields decode safely.

- [ ] **Step 6: Add snapshot construction compatibility**

Update every Rust `Snapshot { ... }` and `RoomState { ... }` fixture with `guards: vec![]` and `failure_guard_id: 0`. Run:

```sh
sh container p2-contract run --rm dev cargo test --workspace
sh container p2-contract run --rm dev npx tsc -p apps/web/tsconfig.json
```

Expected: all existing tests pass with the frozen contract.

- [ ] **Step 7: Record and commit the synchronization boundary**

Update P2 STATE/DECISIONS with the field numbers, enum values, map IDs, container commands, and compatibility evidence. Commit:

```sh
git add proto map apps/web/src/generated spikes crates/authority/src/lib.rs .agent/tasks/p2
git commit -m "feat(protocol): freeze P2 guard contract"
```

### Task 2: Implement deterministic guard simulation

**Files:**
- Modify: `crates/sim/src/lib.rs`
- Test: `crates/sim/src/lib.rs` (`#[cfg(test)]` module)
- Modify: `.agent/tasks/p2/STATE.md`
- Modify: `.agent/tasks/p2/DECISIONS.md`

**Interfaces:**
- Consumes: generated `Guard`, `GuardState`, `FailureReason::Guard`, map guard 51 and waypoints 511/512.
- Produces: `World::snapshot().guards` and guard-caused `RoomState` diagnostics.
- Internal state: `GuardRuntime { config_index, x, z, facing_x, facing_z, state, waypoint_index, state_entered_tick, search_expires_tick, investigation, observed_echo }`.

- [ ] **Step 1: Write failing unit tests for movement and lifecycle**

Add focused tests named:

```rust
#[test] fn guard_patrol_clamps_to_waypoint_and_cycles() { /* 25 mm target, 20 mm steps */ }
#[test] fn guard_echo_enters_investigate_without_failure() { /* source player/tick key */ }
#[test] fn continuous_echo_visibility_does_not_extend_search_forever() { /* >180 ticks */ }
#[test] fn guard_returns_to_deterministic_rejoin_waypoint_then_patrols() { /* waypoint 511 */ }
#[test] fn live_human_wins_detection_priority_over_echo() { /* same authority tick */ }
#[test] fn guard_state_freezes_outside_active_attempt() { /* lobby and failed */ }
#[test] fn restart_restores_complete_guard_initial_state() { /* pose/index/timers/key */ }
#[test] fn invalid_guard_route_has_clear_validation_error() { /* unknown or duplicate waypoint */ }
```

Use existing join/ready/motion helpers and direct test-only map/guard placement helpers rather than wall-clock sleeps.

- [ ] **Step 2: Run only simulation tests and verify failure**

Run: `sh container p2-sim run --rm dev cargo test -p th-sim guard -- --nocapture`

Expected: compilation fails because guard runtime and snapshot behavior are absent.

- [ ] **Step 3: Parse and validate guard map data**

Add serde structs `GuardConfig` and `Waypoint`, require a non-empty unique waypoint
route, positive speed/range/search duration, unique guard/waypoint IDs, and an
initial pose matching the first route point. `World::new` must fail through the
existing checked-in-map `expect` for invalid static data with a guard-specific
message.

- [ ] **Step 4: Implement integer movement and perception helpers**

Add helpers with exact responsibilities:

```rust
fn move_toward(x: &mut i32, z: &mut i32, tx: i32, tz: i32, step: i32) -> bool;
fn visible(origin: (i32, i32), facing: (i32, i32), target: (i32, i32), range: i32, half_width: i32) -> bool;
```

`move_toward` uses integer distance ordering and clamps each final step; `visible`
uses dot/cross products in `i64`, rejects targets behind the guard, and includes
the configured range and cone boundaries.

- [ ] **Step 5: Implement Patrol → Investigate → Return**

Call `self.guards()` after Echo poses are available and before the existing room
result update. Evaluate connected humans first. On human visibility set phase
FAILED, reason GUARD, guard ID, detected player diagnostics, and ended tick. Only
when no human is visible, select the newest Echo source tick, deduplicate by
`(player_id, source_tick / ECHO_OBSERVATION_WINDOW_TICKS)` where the constant is
30 ticks, and enter Investigate. Search expiry is fixed at
arrival tick plus 180. Return targets the lowest-distance route waypoint, breaking
ties by route order.

- [ ] **Step 6: Reset and snapshot guard state**

Reset all runtime fields in the existing attempt reset path. Convert each runtime
guard to the generated protobuf `Guard`; use protobuf message presence (`None`)
when no investigation target exists and publish the authoritative timers.

- [ ] **Step 7: Run simulation and workspace checks**

Run:

```sh
sh container p2-sim run --rm dev cargo fmt --all --check
sh container p2-sim run --rm dev cargo clippy --workspace --all-targets -- -D warnings
sh container p2-sim run --rm dev cargo test -p th-sim
```

Expected: all old simulation tests and all guard tests pass.

- [ ] **Step 8: Commit the simulation**

```sh
git add crates/sim/src/lib.rs .agent/tasks/p2
git commit -m "feat(sim): add deterministic Echo-aware patrol guard"
```

### Task 3: Add guard timeline and presentation semantics

**Files:**
- Modify: `apps/web/src/map.ts`
- Modify: `apps/web/src/timeline.ts`
- Create: `apps/web/src/guard-view.ts`
- Test: `apps/web/test/timeline.mjs`
- Create: `apps/web/test/guard-view.mjs`
- Modify: `containers/verify.sh`

**Interfaces:**
- Consumes: generated `Guard`, `GuardState`, `Snapshot.guards`, and map guard configuration.
- Produces: `Presentation.guards: VisualGuard[]` and `guardVisuals(map, presentation): GuardVisual[]`.
- `VisualGuard` contains `id`, interpolated `xMm/zMm`, canonical facing/state/waypoint/timers, and optional investigation target.

- [ ] **Step 1: Write failing timeline and view tests**

Add tests that interpolate guard 51 halfway between two snapshots, preserve the
newer canonical state/facing, return `[]` for legacy snapshots, and map Patrol,
Investigate, Return, and unknown states to stable body/cone colors. Assert that an
Investigation target at coordinate zero remains present through the optional
`GuardTarget` message rather than being lost through coordinate truthiness.

- [ ] **Step 2: Run browser unit tests and verify failure**

Run:

```sh
sh container p2-web run --rm dev node apps/web/test/timeline.mjs
sh container p2-web run --rm dev node apps/web/test/guard-view.mjs
```

Expected: imports or assertions fail because guard presentation does not exist.

- [ ] **Step 3: Extend map and timeline types**

Parse the checked-in `guards` and `guardedPassage` without duplicating gameplay
decisions. Add `#interpolateGuards(renderTick)` keyed by guard ID. Position is
linear presentation interpolation; state, facing, waypoint, target, and timer
fields come from the later surrounding snapshot.

- [ ] **Step 4: Implement pure guard visual derivation**

In `guard-view.ts`, export:

```ts
export interface GuardVisual { id: number; x: number; z: number; forward: [number, number]; lateral: [number, number]; range: number; halfWidth: number; bodyColor: Color; coneColor: Color; target?: [number, number]; }
export function guardVisuals(map: Facility, presentation: Presentation): GuardVisual[];
```

Normalize facing only for matrices, use a safe `(1, 0)` fallback, and keep all
authority identifiers/state unchanged.

- [ ] **Step 5: Register and pass client checks**

Add `node apps/web/test/guard-view.mjs` to `containers/verify.sh`, then run:

```sh
sh container p2-web run --rm dev npx tsc -p apps/web/tsconfig.json
sh container p2-web run --rm dev npx biome check apps/web/src
sh container p2-web run --rm dev node apps/web/test/timeline.mjs
sh container p2-web run --rm dev node apps/web/test/guard-view.mjs
```

- [ ] **Step 6: Commit presentation semantics**

```sh
git add apps/web/src/map.ts apps/web/src/timeline.ts apps/web/src/guard-view.ts apps/web/test containers/verify.sh
git commit -m "feat(web): derive guard timeline presentation"
```

### Task 4: Render and explain the guard encounter

**Files:**
- Modify: `apps/web/src/render/webgpu.ts`
- Modify: `apps/web/src/room-hud.ts`
- Modify: `apps/web/src/main.ts`
- Modify: `apps/web/src/audio.ts`
- Modify: `apps/web/src/style.css`
- Modify: `apps/web/test/room-hud.mjs`
- Modify: `apps/web/test/audio.mjs`
- Modify: `apps/web/test/presentation-view.mjs`

**Interfaces:**
- Consumes: Task 3 `guardVisuals`, generated guard state, and guard failure diagnostics.
- Produces: raw-WebGPU guard body/cone/path/target primitives and visible guard objective/status text.

- [ ] **Step 1: Add failing HUD, audio, and geometry assertions**

Assert active HUD copy `Use your Echo to distract Guard 51`, investigation copy
`GUARD 51 INVESTIGATING — CROSS WHEN CLEAR`, failure copy containing the canonical guard
ID, one audio transition for entering Investigate, and geometry/colors for all
three states. Keep unknown or absent guard state silent and non-crashing.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```sh
sh container p2-render run --rm dev node apps/web/test/room-hud.mjs
sh container p2-render run --rm dev node apps/web/test/audio.mjs
sh container p2-render run --rm dev node apps/web/test/presentation-view.mjs
```

- [ ] **Step 3: Add guard HUD and synthesized cue**

Derive copy only from snapshot fields. Trigger a short synthesized alert once on
the transition into Investigate, respecting the existing user-unlock and mute
rules. Do not add audio assets or gameplay callbacks.

- [ ] **Step 4: Add raw-WebGPU primitives**

Use the existing persistent cube/wedge buffers. Draw each cone in the translucent
cone pass, then route segments, target marker, and body in the opaque pass. Add no
per-frame GPU buffer allocation. Keep total instances below the existing 256 limit
and add an assertion/test for the authored maximum.

- [ ] **Step 5: Pass client and WebGPU checks**

Run:

```sh
sh container p2-render run --rm dev npx tsc -p apps/web/tsconfig.json
sh container p2-render run --rm dev npx biome check apps/web/src
sh container p2-render run --rm dev node apps/web/test/room-hud.mjs
sh container p2-render run --rm dev node apps/web/test/audio.mjs
sh container p2-render run --rm dev node apps/web/test/presentation-view.mjs
sh container p2-render run --rm dev node spikes/gpu/test.mjs
```

- [ ] **Step 6: Commit renderer and feedback**

```sh
git add apps/web/src apps/web/test
git commit -m "feat(webgpu): render Echo-aware patrol guard"
```

### Task 5: Extend two-client gameplay acceptance

**Files:**
- Modify: `tests/e2e.mjs`
- Modify: `containers/visual-browser.mjs`
- Modify: `tests/visual-browser-contract.mjs`
- Modify: `.agent/tasks/p2/STATE.md`

**Interfaces:**
- Consumes: canonical guard snapshots/failure, visible HUD, and existing `window.th` movement/readback APIs.
- Produces: JSON events `guard-human-failed`, `guard-reset`, `guard-echo-investigating`, `guard-crossed`, and P2 screenshots.

- [ ] **Step 1: Add failing P2 E2E assertions**

Extend the scenario to first drive player 1 into guard 51's cone and assert
`FailureReason.GUARD`, `failureGuardId === 51`, and identical terminal state on both
clients. Restart, ready both clients, record A's decoy route, and assert the guard
does not enter Investigate before the canonical Echo source tick plus 600.

- [ ] **Step 2: Add the cooperative crossing proof**

Wait for `GuardState.INVESTIGATE`, assert its target matches A's Echo pose/source,
move B through `guardedPassage`, and assert the room remains ACTIVE. Continue the
existing three-door/extraction solution and assert both clients reach WON with the
same guard snapshot.

- [ ] **Step 3: Add GPU and visible evidence**

Read back a stable pixel inside the guard cone before and during Investigate, assert
the documented state color, capture labeled failure/investigation/crossing/win
screenshots, and require empty browser/renderer error arrays. Extend visual metadata
with guard state and keep both Chromium profiles independent.

- [ ] **Step 4: Run full acceptance**

Run: `sh container p2-e2e acceptance`

Expected: direct human failure, clean restart, exact-600-tick Echo lure, safe B
crossing, all existing Echo doors, extraction, WebGPU state colors, and identical
two-client final state pass.

- [ ] **Step 5: Commit acceptance**

```sh
git add tests containers/visual-browser.mjs .agent/tasks/p2/STATE.md
git commit -m "test(e2e): prove cooperative Echo guard diversion"
```

### Task 6: Integrate, review, and release-verify P2

**Files:**
- Modify: `.agentic/PROJECT.md` only if stable commands or facts changed
- Modify: `.agent/tasks/p2/STATE.md`
- Modify: `.agent/tasks/p2/DECISIONS.md`
- Modify: `README.md`
- Modify: `docs/GAMEPLAY.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PROTOCOL.md`

**Interfaces:**
- Consumes: Tasks 1–5 at the frozen contract revision.
- Produces: merge-ready P2 branch/PR(s), durable evidence, and reproducible commands.

- [ ] **Step 1: Sync dependent branches after contract freeze**

Rebase each isolated component worktree onto the committed Task 1 contract before
implementation. Integrate simulation before browser/E2E only where generated or
snapshot types require it; do not copy uncommitted files or depend on live services
from another worktree.

- [ ] **Step 2: Run complete component verification**

Run: `sh container p2-final verify`

Expected: codegen consistency, cross-language protocol, rustfmt, clippy, all Rust
tests, TypeScript, Biome, browser suites, production build, and containerized
Chromium WebGPU/WGSL checks pass.

- [ ] **Step 3: Run clean full-stack acceptance and visual evidence**

Run:

```sh
sh container p2-final acceptance
sh container p2-final down --volumes --remove-orphans
sh container p2-visual visual
sh container p2-visual down --volumes --remove-orphans
```

Record both clients' SwiftShader/hardware adapter data, renderer errors, screenshots,
and guard/Echo authoritative ticks in STATE.

- [ ] **Step 4: Run two-worktree isolation**

Run:

```sh
sh containers/verify-two-stack-isolation.sh \
  /path/to/p2-a p2-isolation-a \
  /path/to/p2-b p2-isolation-b \
  /tmp/temporal-heist-p2-isolation
```

Expected: both acceptance exits are zero; container/network/volume/profile resources
are disjoint; no fixed host ports exist; removing A with volumes leaves B IDs and
in-network health unchanged.

- [ ] **Step 5: Perform independent whole-branch review**

Review guard determinism, integer overflow, state priority, Echo deduplication,
protocol compatibility, renderer authority separation, container isolation, and
E2E false positives. Fix every correctness finding and repeat only affected checks.

- [ ] **Step 6: Update durable documentation and commit**

Record actual commands/results, adapter/backend, limitations, and next action.
Update gameplay/architecture/protocol docs with final semantics, then commit:

```sh
git add .agentic .agent/tasks/p2 README.md docs
git commit -m "docs(p2): record guard stealth release evidence"
```

- [ ] **Step 7: Publish review topology and monitor CI**

Use one contract PR followed by dependent simulation/presentation/acceptance PRs
only if each remains independently reviewable; otherwise squash the integrated
feature into one focused P2 PR. Push feature branches, create PRs, and monitor the
same container entry points in CI. Do not merge the default branch without the
user's explicit approval immediately before merge.
