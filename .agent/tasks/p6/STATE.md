# P6 state

## Status

Artifact-contract layer is implemented and locally verified from main `5d974a9`.
Named hardened release images, provenance manifest, exact web health, and headed
noVNC play surfaces are ready for review. Runtime reliability remains unstarted.

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

## Next action

Open the artifact-contract base PR, then branch `p6/runtime-reliability` on this
verified contract without waiting for the base PR to merge.
