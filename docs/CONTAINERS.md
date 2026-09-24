# Container execution and parallel-agent contract

## Purpose

Temporal Heist is developed, executed, and verified entirely through containers.

This is not only for reproducibility. It is a concurrency requirement: multiple coding agents must be able to implement and test different parts of the system at the same time without sharing mutable runtime infrastructure.

## Hard rule

No project process runs directly on the host.

The host may provide:

- Git and worktree operations;
- Codex/agent runtime;
- Docker/OCI runtime and Compose-compatible orchestration;
- editor/terminal tooling that does not execute the application toolchain.

The following run inside containers:

- dependency installation;
- Rust and TypeScript compilation;
- protobuf/code generation;
- formatting, linting, type checking, and tests;
- MoQ relay;
- authority server;
- web development/preview server;
- Chromium/Playwright or equivalent browser process;
- WebGPU smoke/render verification;
- integration and E2E harnesses.

A host-native project command can be useful for diagnosis only if unavoidable, but it is never accepted as verification evidence and must not become a documented prerequisite.

## Per-agent identity

Every concurrent agent/run has an ID, for example:

~~~text
AGENT_ID=sim-a
AGENT_ID=webgpu-b
AGENT_ID=moq-c
~~~

The exact variable/helper naming is an implementation choice, but it must deterministically namespace orchestration resources.

A typical Compose namespace is conceptually `COMPOSE_PROJECT_NAME=temporal-heist-<agent-id>`.

Do not use hard-coded `container_name`.

## Worktree isolation

Every writing agent uses its own Git worktree/checkout.

A writing agent owns a disjoint file/component scope for the parallel wave. Multiple writers never mutate the same checkout.

Read-only source inspection can happen anywhere, but build/test outputs remain inside that agent's container/volume namespace.

## Runtime isolation

Each agent stack owns its own:

- Compose project;
- container network;
- relay;
- authority process;
- web process;
- browser/test process;
- writable package/build caches;
- certificates/keys generated for local transport;
- browser profiles;
- logs;
- screenshots/videos/traces;
- test data and room IDs.

No mutable application service is shared between agents.

If a cache is ever shared for performance, it must be demonstrably content-addressed/read-only from agent jobs or otherwise safe against cross-agent mutation. The default is isolated writable caches.

## Ports

Automated tests must not require fixed host ports.

Within a stack, use container-network service discovery.

If host access is required for a human/diagnostic surface, allocate a unique/ephemeral published port per agent and record how it is discovered. A fixed `localhost:8080`-style dependency is not acceptable for parallel tests.

## Parallel full stacks

It must be possible to run two or more complete stacks concurrently:

~~~text
agent A: relay A + authority A + web A + Chromium A1/A2
agent B: relay B + authority B + web B + Chromium B1/B2
~~~

Stopping/removing agent A with volumes must leave agent B unaffected.

This should be covered by a reproducible isolation test.

## Contract-first synchronization

"Fully parallel" does not mean concurrently editing one source-of-truth schema.

The narrow serialized boundary is:

- protobuf schemas;
- generated-code source definitions;
- shared semantic interfaces between sim/authority/client;
- container command contract if all components depend on it.

Bootstrap/freeze the minimum viable version of those contracts first.

After that point, independent agents should be able to build and test their owned components using only checked-in contract sources.

When a contract change is necessary:

1. serialize ownership of the contract change;
2. update the source of truth;
3. regenerate/verify consumers inside containers;
4. commit/version the changed contract;
5. rebase/sync dependent worktrees as appropriate;
6. resume parallel implementation.

Do not coordinate by copying generated files between agents or by depending on another agent's live container.

## Recommended component boundaries

The exact code layout is reversible, but parallel ownership should roughly support:

- **sim agent** — pure deterministic Rust simulation and Echo semantics;
- **authority agent** — authority process and server-side adapter around sim/protocol;
- **MoQ agent** — transport spike/adapters and relay integration;
- **web agent** — browser state/timeline/input layers;
- **WebGPU agent** — raw WebGPU renderer/WGSL;
- **protocol agent** — protobuf/codegen/cross-language compatibility;
- **E2E agent** — Compose topology, containerized Chromium, integration/E2E verification.

The orchestrator may choose fewer or more agents; these are ownership boundaries, not a required agent count.

## Image/toolchain design

Container images should be reproducible and cacheable.

Prefer a small set of roles rather than one giant mutable development container, while avoiding unnecessary image proliferation. Typical roles may include:

- Rust build/test/runtime;
- JS/TypeScript build/test/web;
- relay;
- browser/E2E;
- optional combined dev image for cross-language protocol tests.

Pin or otherwise reproducibly resolve important toolchain versions. Dependency lockfiles remain authoritative.

Do not require a developer to install the language toolchains on the host.

## WebGPU in containers

Raw WebGPU acceptance must execute in containerized Chromium.

Two acceptable strategies:

1. verified software GPU/Vulkan path suitable for CI and general agent hosts;
2. explicit GPU device passthrough on capable hosts.

The default automated path should be as portable as practical. Tests must report the selected WebGPU adapter/backend so an agent can distinguish a real GPU path from software rendering.

A software adapter is acceptable for deterministic smoke/render tests; performance claims require appropriate hardware and are outside P0.

## Browser/E2E

The normative E2E browser process is containerized.

The E2E stack needs two independent browser contexts/instances representing the two players. They connect to services through the stack's private network.

For manual visual acceptance, expose a remote display, VNC/noVNC, remote-debugging UI, or another container-owned browser surface. Do not make host Chromium a prerequisite.

## Test entry points

Bootstrap should create stable commands with semantics comparable to:

~~~text
container check
container test
container test-protocol
container test-transport
container test-integration
container test-e2e
container test-webgpu
container up
container down
~~~

These names are illustrative. The implementation may use `make`, `just`, shell wrappers, or Compose profiles, but wrappers executed on the host must only orchestrate containers.

Record the finalized commands in `.agentic/PROJECT.md`.

The finalized entry points are `sh container <run-id> bootstrap`, `verify`, and
`acceptance`. Raw Compose operations remain available after the run ID. Complete
cleanup is `sh container <run-id> down --volumes --remove-orphans`.

`verify` uses the combined development image for Rust/TypeScript compilation,
protobuf generation, and cross-language tests. `acceptance` and `visual` instead
use multi-stage runtime images containing only the release authority, built web
assets served by nginx, or the Chromium test runtime. They pull the digest-pinned
official `moqdev/moq-relay:0.14.18` image rather than compiling a relay. BuildKit
layers may be immutable-cache shared, while every writable Compose volume remains
private to its run ID.

Manual visual inspection uses `sh container <run-id> visual`. It starts the private
relay, authority, web service, and separate container-owned Chromium A/B services.
Each browser has its own `visual-profile-a` or `visual-profile-b` volume and an
ephemeral loopback noVNC host port. The command verifies display processes and an
RFB WebSocket handshake before printing both URLs. Open either URL in a host browser
to view and control that player's container desktop.

The noVNC client is the only host-side UI. Game execution, both Chromium
processes, their persistent profiles, and WebGPU remain inside the run-ID Compose
project. Labeled screenshots and renderer/error metadata are stored in the run's
artifact volume. The game stays live and interactive after automated capture. Remove the stack and
both profiles with the standard `down --volumes --remove-orphans` command.

The printed cleanup command remains required because noVNC ports and container
processes stay alive until it is run.

## CI

CI invokes the same containerized commands.

The CI runner may install/use Docker, but it should not separately install Rust/Node/protobuf/browser toolchains in order to test the project.

Keep CI behavior aligned with local agent execution so a passing local container check means the same thing in CI.

## Acceptance for isolation

Parallel isolation is verified when:

1. two different worktrees are checked out;
2. each starts its own namespaced integration or full E2E stack;
3. both stacks run concurrently;
4. both pass representative checks;
5. resource inspection shows distinct networks/containers/writable volumes/profiles;
6. tearing one stack down with volumes does not interrupt the other.

Document the exact verification command and evidence in `.agent/tasks/vertical-slice/STATE.md`.

The release wrapper creates two detached clean worktrees at the current revision:

~~~sh
sh container <run-id> two-stack-isolation
~~~

Each worktree starts a complete `visual` stack: relay, authority, web, Chromium A,
and Chromium B. The Chromium services own separate browser-profile volumes and
publish noVNC only on distinct ephemeral loopback ports. The harness checks disjoint
container, network, writable-volume, profile, room, artifact, and port identities.
It exports both players' PNG screenshots and JSON renderer metadata from each stack
before removing either artifact volume. It then removes stack A with volumes and
proves stack B retained the same resource IDs, web health, and both RFB displays.

Evidence is schema version 1 at
`.release/<run-id>/isolation/manifest.json`. Its `artifactsA` and `artifactsB`
arrays name the four screenshot/metadata pairs stored below the same directory.
Visual build logs, source SHA, projects, resource IDs, loopback ports, teardown
result, and post-teardown display result are part of the manifest. Both child
projects are explicitly taken down with volumes before their temporary worktrees
are removed on normal or abnormal wrapper exit.

The complete RC evidence command is:

~~~sh
sh container <run-id> release-evidence
~~~

Every attempt first clears that run's private artifact volume and ignored host
evidence directory. A successful attempt strictly exports the volume, builds the
schema-v1 index from the exported tree, and writes
`.release/<run-id>/index.json` only after every required export passes. A failed attempt may export partial
diagnostics on a best-effort basis, but must not retain a prior `passed` index.
CI uploads these ignored directories before deleting Compose volumes.
