# Vertical slice state

## Status

Initial environment spike started on 2026-09-22; blocked on access to an OCI runtime.

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

- The current host does not expose a usable OCI runtime. `docker version` and
  `docker compose version` both returned `command not found` (exit 127).
- `command -v docker podman nerdctl colima orb` found no runtime. Read-only
  inspection of `/Applications`, `/Users/a/Applications`, `/usr/local/bin`,
  `/opt/brew/bin`, and `/opt/brew/Caskroom` found no installed Docker Desktop,
  Podman, Colima, or OrbStack. `/Users/a/.docker/bin`, `/Users/a/.colima`,
  `/Users/a/.orbstack`, and `/var/run/docker.sock` are absent.
- Requested an existing runtime location/connection or permission to install
  Docker Desktop. Installing a host application changes files outside the
  workspace; no installation or license acceptance has been performed.
- No host-native application toolchain was executed as a fallback.

## Initial spike progress (2026-09-22)

- Read all eight required project/task/design documents and root `AGENTS.md`.
- Repository was clean at start, at commit `cd95141`.
- Started read-only official-source MoQ API/version research independently of
  the runtime prerequisite. Source inspection is not transport verification.
- Shared contracts are not frozen. Container codegen/consumer compatibility
  and the required transport/WebGPU spikes must pass before the implementation
  wave begins. No writing subagents or shared mutable stacks were started.
- Existing `.github/workflows/agentic-contract.yml` uses host Python. Move its
  checks behind the same container entry point used locally during bootstrap;
  do not retain a divergent host-native verification path. Its existing
  `test ! -d scripts` layout check also constrains wrapper placement (use a
  root wrapper or a dedicated container directory).

### Immediate continuation

1. Resolve the OCI runtime prerequisite; check both client/daemon connectivity
   and Compose availability.
2. Build the minimal namespaced container spike, then prove two concurrent
   stacks and teardown independence. Use no fixed host ports or global volumes.
3. Verify MoQ bidirectional browser/Rust payloads, containerized Chromium
   WebGPU, and protobuf cross-language vectors before freezing contracts.
4. Commit the verified contract baseline and allocate disjoint isolated
   worktrees/runtime namespaces for parallel component implementation.

### Preliminary MoQ source research (not verified dependencies)

Official-source inspection returned inconsistent moving/cached versions:
`@moq/net` main manifest reported 0.3.5, `moq-net` main reported 0.2.22,
while docs.rs latest resolved to 0.2.20. The release listing reported
`moq-relay` 0.14.18, while a main manifest response reported 0.14.13.
These are research observations, not a selected compatible version triple.
Re-resolve registry metadata inside the container and inspect the exact
downloaded versions before implementing adapters or committing lockfiles.

Starting sources:

- https://github.com/moq-dev/moq/releases
- https://github.com/moq-dev/moq/tree/main/js/net
- https://github.com/moq-dev/moq/tree/main/rs/moq-net
- https://docs.rs/moq-net/latest/moq_net/

The current docs describe grouped retention/history and fetch-by-sequence;
verify availability and semantics in the selected browser/native versions.
Keep bounded authority-origin bootstrap over MoQ as the documented fallback.

Research pointers for the next spike:

- Browser example APIs: `Connection.connect`, `Broadcast.Producer`,
  `publish`, `createTrack`, `appendGroup`, `writeFrame`, and
  `consume(...).track(...).subscribe(...).recvGroup()`:
  https://doc.moq.dev/lib/js/net
- Rust examples use `moq_native::ClientConfig` and `moq_net::Origin`:
  https://doc.moq.dev/lib/rs/
- Current TS source describes `fetchGroup(sequence)`, subscription
  `startGroup`/`endGroup`, and `latencyMax`; reported default retention is
  only five seconds, so explicitly verify a longer window or use bootstrap:
  https://raw.githubusercontent.com/moq-dev/moq/main/js/net/src/track.ts
- Check certificate hostnames against Compose service DNS. Do not assume
  the documented localhost fingerprint bootstrap works for `http://relay`:
  https://doc.moq.dev/bin/relay/config
- Record the actually negotiated transport because browser connection setup
  may race WebTransport and WebSocket. Application payloads must still pass
  through the real MoQ adapters/relay.

Run `npm view @moq/net version dist.integrity`, `cargo search moq-net --limit 1`,
`cargo search moq-relay --limit 1`, and `cargo info` for those crates only
inside the future toolchain container. These are investigation commands,
not finalized repository entry points or evidence of successful execution.

## Verification status

No application tests exist or have passed yet. Runtime discovery above is
environment diagnosis only, not acceptance evidence. All acceptance criteria,
two-full-stack isolation, WebGPU adapter/backend, and containerized quality
gates remain unverified. No finalized build/test/dev commands exist yet.

## State maintenance

Update this file at meaningful milestones with:

- implemented slices;
- exact verification commands and outcomes;
- integration blockers;
- deviations from the design and links/rationale recorded in `DECISIONS.md`;
- the next concrete action.
