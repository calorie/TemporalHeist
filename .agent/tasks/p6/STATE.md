# P6 state

## Status

Artifact-contract, runtime-reliability, and release-evidence source layers are implemented
and container-verified.
Authority health/readiness, structured lifecycle logs, bounded shutdown, reconnecting
MoQ sessions, browser write-failure recovery, Compose health ordering, deterministic
resource bounds, and real two-browser restart recovery are complete.

## Review stack

1. `p6/artifact-contract` — named/labelled hardened images and release manifest.
2. `p6/runtime-reliability` — health, shutdown, outage recovery, resource bounds.
3. `p6/release-evidence` — clean-checkout smoke, soak, CI artifacts, isolation.

## Audit findings

- Existing runtime images are multi-stage and pinned, but have no stable names,
  revision metadata, manifest, non-root/read-only contract, or release command.
- `/healthz` currently succeeds through SPA fallback and Compose has no healthchecks.
- Authority info logs are silent by default and Docker SIGTERM is not explicit.
- Browser automatic relay recovery and authority epoch reset are not acceptance-tested.
- CI deletes its evidence volume without uploading artifacts.
- README status and task pointers stop at P3.

## Verification

- TDD RED: `release-artifact-contract.mjs` rejected the missing release wrapper,
  image metadata, hardening, and noVNC contract before implementation.
- `sh container p6-artifact-agent release-inspect`: passed; both runtime images omit
  cargo/rustc/node/npm/git and source, use numeric non-root users, reject root writes,
  accept explicit `/tmp` writes, and produced schema-v1 JSON with IDs/digests/sizes/
  labels/source SHA.
- `sh container p6-artifact-agent release-smoke`: passed for relay/authority/web,
  exact `/healthz`, UID 65532/101, read-only root, cap drop, and no-new-privileges.
- First `visual` probe failed because HTTP inspection raced noVNC startup. A bounded
  in-container ready loop fixed it. Rerun passed two independent ephemeral loopback
  ports, noVNC HTML, actual Temporal Heist targets, and SwiftShader WebGPU metadata.
- First `verify` run passed Rust and TypeScript checks, then correctly failed the old
  manual-browser contract's fixed `9222` expectation. Updating it to the noVNC `6080`
  contract made the full rerun pass: 8 authority tests, 39 simulation tests, all web/
  protocol/contracts, raw WebGPU at two viewports, and production build/browser UX.
- `sh container p6-artifact-agent acceptance`: passed the full two-client mission,
  Temporal Bridge agreement, restart/reset flow, and zero browser/renderer errors.
- noVNC/Xvfb packages were moved to a dedicated `visual-browser` target so automated
  acceptance keeps the smaller browser runner. The separated target passed both
  noVNC endpoint probes and actual A/B Temporal Heist/WebGPU target inspection on
  ephemeral loopback ports `61373` and `61372`.
- An early release-build compiled both images successfully but returned
  `container: line 90: relay: command not found` because the wrapper file was edited
  while that shell was still reading it. A stable-file rerun passed and the condition
  is not present in the implementation.
- Independent review found that visual capture permanently paused the play surface,
  display readiness did not traverse WebSocket/RFB, and release tags could collide
  while dirty inputs still claimed HEAD provenance. Focused RED tests reproduced all
  three findings. The implementation now keeps rendering live, checks all three
  display processes plus an RFB 3.8 handshake, rejects dirty release contexts, and
  qualifies local image references by run ID.
- Review-fix verification passed the focused container contracts and full `verify`
  suite. `visual` completed A/B RFB 3.8 handshakes, found both Temporal Heist targets,
  and reported SwiftShader WebGPU on ephemeral loopback ports `61630` and `61629`.
  Killing websockify made the bounded display checker fail as required. A dirty-tree
  `release-build` was rejected before any image build.
- Clean commit `010f0b8` passed `release-build`, `release-inspect`, and
  `release-smoke`. The schema-v1 manifest recorded run-qualified references,
  immutable IDs/digests/sizes/labels, and the exact clean source SHA. Runtime
  containers passed exact health, fixed UID/GID, read-only root, dropped capability,
  no-new-privileges, writable tmpfs, and forbidden tool/source absence checks.
- Runtime contract RED rejected missing healthchecks, readiness, logging, and write
  failure recovery. GREEN passed authority health coverage and an active two-player,
  216,000 virtual-tick soak with 1,438 accepted terminal actions and sustained legal
  movement. Both players move into terminal 31 range before acting; retained live and
  Echo actions reach 40–50 entries rather than remaining empty. The soak kept
  at most 221 retained network samples, 1,024 pending inputs, 128 queued replication
  frames, 64 KiB snapshots, and 2 MiB history chunks. Exact-boundary tests prove the
  encoded payload limits reject oversize data before MoQ `write_frame`.
- The health listener services one connection at a time and applies a 250 ms bound to
  the complete read/write exchange. A slow-client test proves a partial request cannot
  retain the listener indefinitely or create unbounded tasks. Fragmented requests wait
  for the complete HTTP header terminator; incomplete headers are capped at 4 KiB and
  receive 431 rather than allowing memory growth or a premature close/RST.
- `sh container p6-runtime-agent runtime-reliability` passed real fault injection:
  relay stop preserved liveness while readiness changed ready → unready → ready;
  authority container RestartCount, StartedAt, `authority_started` count, process
  identity, and epoch stayed fixed. Authority restart changed epoch, and Docker
  SIGTERM logged `shutdown_complete` and exited within five seconds.
- `sh container p6-runtime-agent runtime-browser-recovery` passed with two Chromium
  clients. Both reconnected without reload (`navigation` counts `[1,1]` and in-memory
  identities survived), kept the epoch, resumed ticks/movement, then discarded the old
  Timeline/Temporal Bridge after authority restart. Both clients produced a non-null
  presentation for the new epoch with zero stale segments/pulses, rejoined, readied,
  and reached Active with zero page or renderer errors.
- Full `verify` passed fmt/clippy, 10 authority tests, 39 simulation tests, TypeScript,
  protocol, browser UX, and raw WebGPU SwiftShader checks. Fresh `acceptance` passed
  the complete two-client mission and Temporal Bridge agreement with zero errors.
- Acceptance initially reused Active state left by recovery and failed its Lobby
  precondition. It now force-recreates and health-waits the runtime. Agent-qualified
  BuildKit Cargo caches reduced a source-only authority rebuild from more than four
  minutes to 31 seconds; unchanged builds are cache hits.
- Release-evidence contract RED rejected the missing clean-checkout evidence, soak,
  isolation, scheduled CI, and unconditional upload entry points. GREEN adds a
  schema-v1 index over image provenance, Compose resources, lifecycle logs, browser
  epochs/errors/screenshots, WebGPU adapter/backend, and fixed-tick maxima.
- The exact 216,000-tick two-player soak passed in 36.54 seconds with 1,438 submitted
  actions, 6,000 active samples, 48 retained actions, 221 history samples, an 838-byte
  maximum snapshot, and a 185,875-byte maximum history payload.
- Stack 3 full `sh container p6-evidence-agent verify` passed container-only fmt/clippy,
  12 authority tests, 39 simulation tests, protocol compatibility, TypeScript/Biome,
  source contracts, SwiftShader WebGPU, the production build, and Chromium browser UX.
- CI keeps component checks on every PR, limits normal full acceptance to top/main,
  and reserves RC evidence plus simultaneous isolation for release, manual, and weekly
  runs. Pinned upload-artifact v7.0.1 runs with `if: always()` before cleanup.

## Next action

Commit Stack 3, run clean-checkout `release-evidence`, then run automated two-worktree
isolation and independently review the resulting commit.
