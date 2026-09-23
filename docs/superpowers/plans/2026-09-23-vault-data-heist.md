# Vault Data Heist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete authority-owned heist loop in which a live player steals data from a vault terminal before both players use the existing Echo escape door and extract.

**Architecture:** Extend protocol major 1 with one attempt-scoped room boolean and add one explicit map objective. Build deterministic theft validation and win gating in Rust, then add authoritative client targeting/presentation, and finally extend the existing two-browser acceptance without adding another long CI job.

**Tech Stack:** Rust 1.98.1, Protocol Buffers/prost 0.14.4, TypeScript 7.0.2/ts-proto 2.12.4, raw WebGPU/WGSL, WebAudio, MoQ, Docker Compose, containerized Chromium 153.

**Spec:** `docs/superpowers/specs/2026-09-23-vault-data-heist-design.md`

## Global Constraints

- All project execution, build, code generation, tests, Chromium, and WebGPU run through `sh container <unique-run-id> ...`.
- Keep protocol major 1; the only wire addition is `RoomState.objective_secured = 12`.
- Only a connected live player within the authored radius can secure the objective through existing `ACTION + target_id`.
- Echo Action cannot secure the objective; invalid actions fail closed without a new failure reason.
- Objective state is an attempt-scoped team fact with no carrier, attribution, acquisition tick, inventory, drop, score, or checkpoint.
- Victory requires objective secured, Echo-opened final door, and two live players in extraction.
- Renderer and client state never become gameplay authority.
- Every writing worker gets its own worktree, run ID, Compose namespace, network, caches, services, browser profiles, certificates, artifacts, and logs.
- Preserve the four-layer stack: `p3/contract-map` → `p3/authority-mission` → `p3/client-presentation` → `p3/full-mission-e2e`.

## Review Focus

- A legacy snapshot that omits field 12 must decode as unsecured in both Rust and TypeScript; Task 1 adds the cross-language case.
- Replayed Echo Action, disconnected input, wrong target, and out-of-range input must leave the objective unsecured; Task 2 tests each class.
- Simultaneous valid actions must produce one monotonic secured state and no duplicate mission transition; Task 2 tests idempotence.
- A client must not hide the terminal or advance the HUD from local input before an authoritative snapshot; Task 3 tests snapshot-driven presentation.
- Players standing in extraction before theft must remain ACTIVE, then win only after all three predicates are true; Tasks 2 and 4 test both orderings.

---

### Task 1: P3.1 additive protocol and map contract

**Branch:** `p3/contract-map` based on `main`

**Files:**
- Modify: `proto/temporal_heist.proto`
- Modify: `map/facility.json`
- Modify: `crates/sim/src/lib.rs` (map deserialization/validation only)
- Modify: `apps/web/src/map.ts`
- Generate: `apps/web/src/generated/temporal_heist.ts`
- Modify: `spikes/protocol/src/main.rs`
- Modify: `spikes/protocol/check.mjs`
- Modify: `docs/CONTRACT_V1.md`
- Modify: `docs/GAMEPLAY.md`
- Modify: `docs/PROTOCOL.md`
- Modify: `.agent/tasks/p3/{STATE,DECISIONS}.md`

**Interfaces:**
- Consumes: `InputKind::Action`, `Input.target_id`, independently decodable `Snapshot`, protocol major 1.
- Produces: protobuf `RoomState.objective_secured: bool`; Rust map `VaultObjective { id: u32, x: i32, z: i32, radius: i32 }`; TypeScript `Facility.objective`; authored stable objective ID `61`.

- [ ] **Step 1: Add failing cross-language and legacy protocol assertions**

In `spikes/protocol/src/main.rs`, set `objective_secured: true` in the Rust P3 room fixture and assert the TypeScript-produced legacy room decodes `false`. In `spikes/protocol/check.mjs`, require Rust output to decode `objectiveSecured === true`, then encode a room without field 12 for the Rust legacy assertion.

Run:

```sh
sh container p3-contract-red run --rm dev sh -lc 'npm ci >/dev/null && sh spikes/protocol/check.sh'
```

Expected: FAIL because generated `RoomState` has no `objectiveSecured` and Rust has no `objective_secured`.

- [ ] **Step 2: Add the protobuf field and regenerate TypeScript**

Append to `RoomState`:

```proto
bool objective_secured = 12;
```

Generate only inside the container:

```sh
sh container p3-contract run --rm dev sh -lc 'npm ci >/dev/null && sh containers/codegen.sh'
```

Expected: `apps/web/src/generated/temporal_heist.ts` exposes `objectiveSecured`, encodes tag 96, and defaults to `false`.

Set `objective_secured: false` in the existing production `RoomState` constructor
in `crates/sim/src/lib.rs` so the contract layer compiles and preserves current
behavior. Task 2 replaces this compatibility default with authoritative state.

- [ ] **Step 3: Add a failing map contract test**

Add a Rust test that deserializes the checked-in map and asserts:

```rust
assert_eq!(world.map.objective.id, 61);
assert_eq!((world.map.objective.x, world.map.objective.z), (21000, 4000));
assert_eq!(world.map.objective.radius, 750);
```

Also extend validation tests so objective ID `31` conflicts with a terminal, radius `0` fails, and a point outside map bounds fails.

Run:

```sh
sh container p3-contract-red run --rm dev cargo test -p th-sim objective_map_contract -- --exact
```

Expected: FAIL because `Map` has no objective.

- [ ] **Step 4: Implement and document the frozen map contract**

Add to `map/facility.json`:

```json
"objective": {"id": 61, "x": 21000, "z": 4000, "radius": 750}
```

Add the matching Rust serde struct/field and `Facility` TypeScript field:

```ts
objective: Point & { radius: number };
```

Validate positive radius, bounds, and global target-ID uniqueness across terminals and the objective. Document field 12, objective ID 61, live-human-only capability, and legacy default in the three semantic docs.

- [ ] **Step 5: Verify the contract layer**

```sh
sh container p3-contract verify
git diff --check
```

Expected: codegen comparison, Rust↔TypeScript spike, formatting, Clippy, all existing tests, TypeScript/Biome, Vite, and WebGPU pass. Tear down with:

```sh
sh container p3-contract down --volumes --remove-orphans
```

- [ ] **Step 6: Record and commit P3.1**

Update `.agent/tasks/p3/STATE.md` with the exact code revision, command, test counts, compatibility result, and cleanup. Update `DECISIONS.md` with objective ID/coordinates/radius and field number.

```sh
git add proto map crates/sim/src/lib.rs apps/web/src/map.ts apps/web/src/generated/temporal_heist.ts spikes/protocol docs .agent/tasks/p3
git commit -m "feat(p3): freeze vault mission contract"
```

Initialize the next stack layer:

```sh
XDG_DATA_HOME=/tmp/temporal-heist-gh-data gh stack add p3/authority-mission
```

---

### Task 2: P3.2 deterministic authority mission logic

**Branch:** `p3/authority-mission` based on `p3/contract-map`

**Files:**
- Modify: `crates/sim/src/lib.rs`
- Modify: `.agent/tasks/p3/{STATE,DECISIONS}.md`

**Interfaces:**
- Consumes: `Map.objective`, `InputKind::Action`, target ID 61, `RoomState.objective_secured`.
- Produces: deterministic `World.objective_secured: bool`; live-action validation; reset and win semantics consumed by all snapshots and the client.

- [ ] **Step 1: Write failing theft-validity tests**

Add focused `th-sim` tests using existing joined/ready helpers. Assert a valid connected player at `(21000, 4000)` targeting 61 secures the objective. Table-test these inputs as no-ops: player at `(20249, 4000)`, target 31, unknown target, disconnected session, lobby action, failed action, won action, and an Echo pulse with target 61.

Run:

```sh
sh container p3-authority-red run --rm dev cargo test -p th-sim objective_ -- --nocapture
```

Expected: FAIL because snapshots cannot become secured.

- [ ] **Step 2: Write failing idempotence, reset, freeze, and win-order tests**

Cover these exact transitions:

```text
two valid ACTION inputs on one tick -> objective_secured true once
objective false + echo door true + extraction 2 -> ACTIVE
objective true + echo door false + extraction 2 -> ACTIVE
objective true + echo door true + extraction 1 -> ACTIVE
all three true -> WON
WON + later input -> state frozen
RESTART -> objective false in LOBBY
```

Run the same focused command and observe failures before implementation.

- [ ] **Step 3: Implement the smallest authority-owned state transition**

Add `objective_secured: bool` to `World`, initialize/reset it to false, and publish it in `RoomState`. In active input application, branch targeted live actions:

```rust
if input.target_id == self.map.objective.id {
    if self.live_player_in_objective_range(input.player_id) {
        self.objective_secured = true;
    }
    continue;
}
```

The range test uses squared integer distance against the authored radius. Do not enqueue an `AppliedAction` for objective theft and do not let `replay_actions()` mutate the flag. Gate `RoomPhase::Won` on all three predicates.

- [ ] **Step 4: Run focused and workspace verification**

```sh
sh container p3-authority run --rm dev cargo test -p th-sim objective_ -- --nocapture
sh container p3-authority run --rm dev cargo fmt --all --check
sh container p3-authority run --rm dev cargo clippy --workspace --all-targets -- -D warnings
sh container p3-authority run --rm dev cargo test --workspace
```

Expected: all objective cases and existing guard/Echo/reset tests pass.

- [ ] **Step 5: Verify, record, and commit P3.2**

```sh
sh container p3-authority verify
sh container p3-authority down --volumes --remove-orphans
git diff --check
```

Record exact results in P3 state, then:

```sh
git add crates .agent/tasks/p3
git commit -m "feat(p3): secure vault objective in authority"
XDG_DATA_HOME=/tmp/temporal-heist-gh-data gh stack add p3/client-presentation
```

---

### Task 3: P3.3 authoritative client presentation

**Branch:** `p3/client-presentation` based on `p3/authority-mission`

**Files:**
- Create: `apps/web/src/objective-view.ts`
- Modify: `apps/web/src/main.ts`
- Modify: `apps/web/src/presentation-view.ts`
- Modify: `apps/web/src/render/webgpu.ts`
- Modify: `apps/web/src/room-hud.ts`
- Modify: `apps/web/src/audio.ts`
- Modify: `apps/web/index.html`
- Create: `apps/web/test/objective-view.mjs`
- Modify: `apps/web/test/{room-hud,presentation-view,audio}.mjs`
- Modify: `containers/verify.sh`
- Modify: `.agent/tasks/p3/STATE.md`

**Interfaces:**
- Consumes: `Facility.objective`, authoritative `snapshot.room.objectiveSecured`.
- Produces: `nearestActionTarget(map, presentation, playerId): number | undefined`; `objectivePrimitives(map, presentation): Primitive[]`; HUD objective sequence; one secured audio edge.

- [ ] **Step 1: Write failing targeting and presentation tests**

In `objective-view.mjs`, cover nearest target 61 inside 750 mm, no target outside, terminal 31 remaining selectable when closer, and secured objective no longer selectable. Assert `objectivePrimitives` returns an active cyan pedestal before authority confirmation and a dim secured pedestal after it.

Run:

```sh
sh container p3-client-red run --rm dev node apps/web/test/objective-view.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement a pure objective view boundary**

Create pure functions that read map plus interpolated presentation. Move the current terminal-only nearest-target calculation out of `main.ts`, include objective 61 only while unsecured, and preserve terminal selection. Return existing renderer primitive shapes; do not issue input or mutate snapshots in this module.

Wire `main.ts` action handling to the pure selector and append objective primitives in `WebGpuRenderer.render()`.

- [ ] **Step 3: Write failing HUD and audio progression tests**

Add snapshots for:

```text
ACTIVE + unsecured -> "Steal the vault data [E]"
ACTIVE + secured + final door closed -> "Open the final door with Echo Presence"
ACTIVE + secured + final door open -> "Reach extraction together (n/2)"
```

Ensure guard state remains in `guardStatus` without replacing the mission objective. For audio, feed unsecured then secured snapshots twice and assert exactly one `objective-secured` cue.

- [ ] **Step 4: Implement authoritative HUD, briefing, and WebAudio cue**

Order HUD predicates from mission fact to escape fact to extraction. Update briefing copy to state that only a live player can operate the vault terminal. Add one short oscillator cue on the false→true room-field edge, resettable by a new unsecured attempt.

- [ ] **Step 5: Register and run client checks**

Add `node apps/web/test/objective-view.mjs` to `containers/verify.sh` beside the other pure client tests.

```sh
sh container p3-client run --rm dev sh -lc 'node apps/web/test/objective-view.mjs && node apps/web/test/room-hud.mjs && node apps/web/test/presentation-view.mjs && node apps/web/test/audio.mjs'
sh container p3-client verify
sh container p3-client down --volumes --remove-orphans
git diff --check
```

Expected: TypeScript, Biome, Vite, raw WebGPU, all client regressions, and workspace tests pass.

- [ ] **Step 6: Record and commit P3.3**

Update state with rendering/backend evidence and exact tests.

```sh
git add apps/web containers/verify.sh .agent/tasks/p3
git commit -m "feat(p3): present the vault mission objective"
XDG_DATA_HOME=/tmp/temporal-heist-gh-data gh stack add p3/full-mission-e2e
```

---

### Task 4: P3.4 complete two-player mission and release evidence

**Branch:** `p3/full-mission-e2e` based on `p3/client-presentation`

**Files:**
- Modify: `tests/e2e.mjs`
- Modify: `tests/screenshot.mjs`
- Modify: `README.md`
- Modify: `.agent/tasks/p3/{STATE,DECISIONS}.md`

**Interfaces:**
- Consumes: target 61, `objectiveSecured`, HUD and renderer behavior from lower layers.
- Produces: one release acceptance proving lobby → guard diversion → live theft → Echo final door → two-player extraction → restart.

- [ ] **Step 1: Add failing acceptance assertions before changing the route**

Extend the existing successful attempt to assert both clients initially see `objectiveSecured === false`. Immediately after the guarded crossing, assert the room remains ACTIVE and objective remains false. Call `action(61)` from the west staging pose before approaching the terminal and assert both clients still report false. Echo-pulse rejection remains covered deterministically by Task 2 rather than adding a browser-only injection hook.

Run:

```sh
sh container p3-e2e-red acceptance
```

Expected: FAIL when the old route reaches extraction without securing data or because the new acquisition event is absent. Preserve logs, then remove the namespace before the green run.

- [ ] **Step 2: Integrate one live terminal interaction into the existing successful route**

After both players cross guard 51, move player A to `(21000, 4000)`, wait for an authoritative pose within radius, call `action(61)`, and wait until both clients publish the same room epoch/tick with `objectiveSecured === true`. Record:

```json
{"event":"objective-secured","targetId":61,"playerId":1,"serverTick":0,"clientAgreement":true}
```

Continue the existing plate 23 recording, Echo-door observation, concurrent extraction, surveillance failure, and restart. Assert the post-restart lobby reports false and the terminal is active again.

- [ ] **Step 3: Add visible evidence without increasing screenshot count materially**

Replace one redundant intermediate screenshot with `objective-secured` for both players. Assert the saved scene contains floor, wall, guard, and the authored objective color/state; assert the HUD says data secured or the next Echo-door objective. Keep both renderer and browser error arrays empty.

- [ ] **Step 4: Run full release verification serially**

Avoid CPU contention by running these one at a time:

```sh
sh container p3-release verify
sh container p3-release acceptance
sh container p3-release visual
```

Inspect copied container screenshots, metadata, WebGPU adapter/backend, canonical tick agreement, and the full JSON event sequence. Then run two clean-worktree stacks at the exact code revision:

```sh
sh containers/verify-two-stack-isolation.sh \
  /Users/a/TemporalHeist/.worktrees/p3-isolation-a p3-isolation-a \
  /Users/a/TemporalHeist/.worktrees/p3-isolation-b p3-isolation-b \
  /tmp/temporal-heist-p3-isolation
```

Expected: both acceptances exit 0 concurrently; all container/network/volume IDs are disjoint; no fixed host ports; deleting A preserves B health and IDs.

- [ ] **Step 5: Clean runtime resources and record final evidence**

```sh
sh container p3-release down --volumes --remove-orphans
git diff --check
```

Record exact commands, code SHA, test counts, objective acquisition tick, Echo source/current tick delta 600, extraction tick, screenshots, errors, GPU backend, isolation resource IDs, known constraints, and cleanup in `STATE.md`. Update README with the vault-theft step while retaining the existing container commands.

- [ ] **Step 6: Commit, review, and submit the stack**

```sh
git add tests README.md .agent/tasks/p3
git commit -m "test(p3): prove the complete vault data heist"
```

Create one focused independent review per layer, fix defects in the owning lower branch, and propagate with:

```sh
XDG_DATA_HOME=/tmp/temporal-heist-gh-data gh stack rebase --upstack
XDG_DATA_HOME=/tmp/temporal-heist-gh-data gh stack submit
```

Monitor every PR's containerized CI. Do not merge any layer until the user gives explicit approval immediately before integration.
