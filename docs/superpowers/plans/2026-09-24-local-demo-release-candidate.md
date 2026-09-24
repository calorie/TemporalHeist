# Local demo Release Candidate implementation plan

## Stack 1 — Artifact contract

Add stable release build/inspect commands, named images, OCI labels, manifest output,
non-root/read-only runtime definitions, exact web health endpoint, and container
contract tests. Prove shipped images omit development tools and source. Provide two
headed container Chromium displays through isolated ephemeral loopback noVNC URLs and
include them in clean-checkout release smoke.

## Stack 2 — Runtime reliability

Add authority `/healthz` liveness and `/readyz` publication readiness, default
structured logs, SIGTERM shutdown, Compose
healthchecks, browser send-failure recovery, relay/authority restart scenarios, and
deterministic resource/payload bounds. Run component and full acceptance.

## Stack 3 — Release evidence

Add clean-checkout release smoke, fixed-tick soak, versioned evidence export and CI
upload, then run verify, acceptance, restart soak, visual evidence, and two-worktree
isolation. Record exact artifacts and known constraints.

CI dependency order is component → acceptance → release/manual restart soak →
two-stack isolation. Evidence upload uses `if: always()` and precedes stack cleanup.
