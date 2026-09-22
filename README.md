# Temporal Heist

Temporal Heist is a browser-based cooperative time-heist prototype built to make timeline transport part of the game mechanic.

Two players move through a top-down 2.5D facility. Each player acquires one authoritative Echo that replays that player's canonical trajectory exactly 10 seconds in the past. Echoes ignore current-world collision, but their presence and previously approved interactions can affect the current authoritative world.

## Technology direction

- Browser client: TypeScript, Vite, raw WebGPU, WGSL.
- Authority server: Rust, deterministic 60 Hz room simulation.
- Realtime data plane: MoQ through `moq-dev/moq`, with browser `@moq/net`, Rust `moq-net`, and `moq-relay`.
- Wire schema: Protocol Buffers unless an implementation spike finds a concrete blocker.
- Initial target: desktop Chromium.
- MVP scope: two players, one 10-second Echo generation, one small three-room facility, no account system or persistent database.
- Execution model: all application build/run/test/browser/WebGPU processes run in containers; concurrent agents use fully isolated per-worktree container stacks.

MoQ is intentionally isolated behind application adapters. The game domain must not depend directly on MoQ library types or wire-protocol details.

## Start here

Repository-wide durable facts are in `.agentic/PROJECT.md`.

The active implementation task is:

- `.agent/tasks/vertical-slice/SPEC.md` — objective, scope, acceptance criteria, and verification requirements.
- `.agent/tasks/vertical-slice/DECISIONS.md` — product and architecture decisions that must not be silently changed.
- `.agent/tasks/vertical-slice/STATE.md` — current implementation state and next action.

Supporting design documents:

- `docs/GAMEPLAY.md` — Echo semantics and vertical-slice gameplay.
- `docs/ARCHITECTURE.md` — authority, client, WebGPU, MoQ boundaries, and intended repository shape.
- `docs/PROTOCOL.md` — room clock, application messages, timeline data, and transport mapping.

## Starting Codex

The repository uses `agentic-engineering`. Install the plugin if needed:

~~~bash
codex plugin marketplace add calorie/agentic-engineering \
  --sparse .agents/plugins \
  --sparse plugins/agentic-engineering
codex plugin add agentic-engineering@agentic-engineering
~~~

Then start Codex in this repository and give it this objective:

> Continue the active `vertical-slice` task. Read `.agentic/PROJECT.md`, `.agent/tasks/vertical-slice/{SPEC,STATE,DECISIONS}.md`, and the design docs. Implement the task end-to-end, maintaining durable task state and verification evidence. Resolve reversible engineering choices autonomously. Do not change product semantics or architecture invariants without recording the reason and requesting input only when the decision is genuinely product-level or irreversible.

Codex should choose its own effort, subagent use, worktrees, verification strategy, and PR topology according to `AGENTS.md`; the user should not need to orchestrate agents.

## Container-only development

All project execution and verification is containerized. Do not run the application toolchain directly on the host. Each concurrent writing agent must use its own worktree and independently namespaced container stack (network, writable volumes/caches, relay, authority, web service, browser profile, and test artifacts). Shared protocol/source-of-truth changes are the narrow synchronization boundary; freeze/version the minimum contract before dispatching a parallel implementation wave.

See `docs/CONTAINERS.md` and `docs/ARCHITECTURE.md` for the normative isolation model.

## Core acceptance scene

1. Player A stands on a pressure plate and later leaves it.
2. Ten seconds after that recorded moment, A's Echo follows the recorded trajectory and occupies the plate.
3. The authority server detects Echo presence and opens the linked door in the current world.
4. Player B passes through the door while A is elsewhere.
5. Two browser clients observe the same authoritative result.

That scene, running through the real relay/authority/browser path and rendered with WebGPU, is the first vertical-slice milestone.

## Status

The P0 vertical slice is implemented. Bootstrap and run every project command through
the container wrapper:

~~~sh
sh container local bootstrap
sh container local verify
sh container local acceptance
sh container local down --volumes --remove-orphans
~~~

`acceptance` runs a private relay, Rust authority, Vite server, and two containerized
Chromium clients. It records JSON evidence and both client screenshots in that run's
private `artifacts` volume. Use a different lowercase run ID for each checkout or
concurrent stack.
