# Temporal Heist

Temporal Heist is a browser-based cooperative time-heist prototype built to make timeline transport part of the game mechanic.

Two players move through a top-down 2.5D facility. Each player acquires one authoritative Echo that replays that player's canonical trajectory exactly 10 seconds in the past. Echoes ignore current-world collision, but their presence and previously approved interactions can affect the current authoritative world.

## Technology direction

- Browser client: TypeScript, Vite, raw WebGPU, WGSL.
- Authority server: Rust, deterministic 60 Hz room simulation.
- Realtime data plane: MoQ through `moq-dev/moq`, with browser `@moq/net`, Rust `moq-net`, and `moq-relay`.
- Wire schema: Protocol Buffers, with generated Rust and TypeScript bindings.
- Initial target: desktop Chromium.
- MVP scope: two players, one 10-second Echo generation, one small three-room facility, no account system or persistent database.
- Execution model: all application build/run/test/browser/WebGPU processes run in containers; concurrent agents use fully isolated per-worktree container stacks.

MoQ is intentionally isolated behind application adapters. The game domain must not depend directly on MoQ library types or wire-protocol details.

## Start here

Repository-wide durable facts are in `.agentic/PROJECT.md`.

The active P6 local demo Release Candidate task is:

- `.agent/tasks/p6/SPEC.md` — release acceptance criteria.
- `.agent/tasks/p6/DECISIONS.md` — release boundary and durable decisions.
- `.agent/tasks/p6/STATE.md` — implementation and verification status.

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

> Read `.agentic/PROJECT.md`, `.agent/tasks/p6/{SPEC,STATE,DECISIONS}.md`, and the gameplay, architecture, protocol, and container docs. Continue from the recorded release state, maintaining durable verification evidence. Resolve reversible engineering choices autonomously.

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

P2 adds a guarded passage: player A records a decoy route; 600 authority ticks
later, A's Echo draws guard 51 into investigation while player B crosses. A live
human in the guard's view fails the attempt. P3 completes the mission: after
diverting the guard, a live player approaches the cyan vault terminal and presses
E to steal its data. Echoes cannot steal. The team then opens the final door with
Echo Presence and reaches extraction together. Restart clears the stolen data
and reactivates the terminal. The complete route runs through the real relay,
authority, browser, and raw WebGPU path.

## Status

P0–P4 and the WebGPU Temporal Bridge are complete. P6 packages that game as a
reproducible, hardened local/container demo Release Candidate.
Bootstrap and run every project command through the container wrapper:

~~~sh
sh container local bootstrap
sh container local verify
sh container local acceptance
sh container local visual
sh container local release-build
sh container local release-inspect
sh container local release-evidence
sh container local two-stack-isolation
sh container local down --volumes --remove-orphans
~~~

Use a fresh lowercase run ID for each checkout and run. `verify` covers generated
protocol compatibility, Rust/TypeScript checks, browser contracts, the production
build, and containerized Chromium WebGPU/WGSL validation. `acceptance` runs the
complete two-player stealth, vault theft, and extraction loop. `visual` captures both players'
container-owned Chromium views. Inspect and copy artifacts from the run's private
`artifacts` volume before `down --volumes` removes it.

The P3 release run passed `p3-t4-release verify`, `acceptance`, and `visual`.
The final route also passed `p3-t4-route acceptance` and two isolated full-stack
acceptances from clean worktrees at `c821886`.
Both clients used the SwiftShader WebGPU adapter with a Mesa llvmpipe Vulkan
compositor; no shader, validation, browser, or renderer errors were reported.
The exact tick, screenshot, adapter, and isolation evidence is recorded in
`.agent/tasks/p3/STATE.md`. The ignored JSON/PNG handoff lives under the release
checkout's `.superpowers/sdd/2026-09-23-vault-data-heist/artifacts/`.

`acceptance` runs a private relay, release Rust authority, nginx static server, and two containerized
Chromium clients. It records JSON evidence and both client screenshots in that run's
private `artifacts` volume. Use a different lowercase run ID for each checkout or
concurrent stack.

`visual` starts separate container-owned headed Chromium A/B services with independent
profiles and prints two ephemeral loopback noVNC URLs after checking the complete
WebSocket/RFB display chain. Open those URLs in any host browser to view and control
the live container display. The host browser is only a remote display client;
Chromium, WebGPU, profiles, and game networking remain in containers. Release image
references include the run ID and release version; release commands reject a dirty
build context so their OCI source revision and manifest describe the inputs used.

To prove release isolation with two clean checkouts and two Chromium displays per
stack, run:

~~~sh
sh container release-isolation two-stack-isolation
~~~

The harness records disjoint containers, networks, volumes, browser profiles,
artifacts, and ephemeral loopback noVNC ports. It removes stack A with its volumes
and verifies stack B's resource IDs, in-network health, and both RFB displays remain
intact. `manifest.json` and both visual-stack logs remain under
`.release/release-isolation/isolation`.
