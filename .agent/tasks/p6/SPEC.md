# P6 Local Container Demo Release Candidate

## Goal

Produce an identifiable, hardened, reproducible local demo release that an evaluator
can build, start, inspect, play, stop, and diagnose with only Git and Docker.

## Product boundary

P6 is a local/container demo RC. The relay remains private to the Compose network and
the playable UI is a container-owned Chromium surface. Public internet ingress,
accounts, matchmaking, public TLS, and authentication are outside this milestone.

## Acceptance criteria

1. A clean checkout builds named authority and web release images through one stable
   container wrapper command using lockfiles and digest-pinned bases.
2. Release images carry OCI source, revision, version, created-time, and title labels;
   a machine-readable manifest records immutable digests, sizes, labels, and source SHA.
3. Shipped authority and web images contain no compiler, package manager, Git, or
   application source and run as non-root with read-only root filesystems plus only
   explicit tmpfs/writable mounts.
   The forbidden development tools are `cargo`, `rustc`, `node`, `npm`, and `git`,
   plus application source; base OS package databases may remain. Runtime checks
   inspect the fixed UID/GID and actually start each image read-only with all Linux
   capabilities dropped and no-new-privileges.
4. Explicit liveness/readiness exists for web, relay, and authority. `/healthz` is an
   exact endpoint rather than SPA fallback, and startup ordering consumes health.
5. Authority emits useful JSON lifecycle/degraded/recovered/shutdown logs by default,
   handles Docker SIGTERM, and exits cleanly with bounded task shutdown.
6. During an active attempt, relay stop/start causes authority and both browsers to
   reconnect automatically; canonical time resumes without browser/page errors.
7. Authority restart creates a new epoch; both clients discard old timeline/Temporal
   Bridge state, rejoin, ready, and continue without mixed-epoch presentation.
8. Deterministic virtual-time/resource tests cover 216,000 ticks, bounded histories,
   queues/actions, encoded snapshot/history payload limits, and existing GPU caps.
9. A clean-checkout release smoke and fixed-tick two-client soak produce versioned
   evidence containing source/image digests, lifecycle events, epochs/ticks, maxima,
   adapter/backend, errors, screenshots, and Compose metadata.
10. CI uses the same container entry points, uploads evidence even on failure, runs
    component checks on every PR, full acceptance on top/main, and restart soak plus
    two-stack isolation on release/manual or scheduled execution.
11. Manual evaluation uses container-owned headed Chromium A/B surfaces exposed by
    independent ephemeral loopback noVNC ports; the host browser only displays and
    sends input to those remote container displays.

## Constraints

- All project build/run/test/browser processes remain container-only.
- No gameplay, protocol, Echo, authority, MoQ, or WebGPU semantic changes.
- No fixed host ports or fixed container names.
- Runtime namespaces remain independently removable with volumes.
- Wall-clock speed, FPS, CPU, and RSS may be recorded but are not pass/fail gates.
