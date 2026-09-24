# P6 decisions

## 2026-09-24 — Release boundary

Target a reproducible local/container demo for evaluators. Keep relay transport and
self-signed test TLS private to Compose. Do not claim internet deployment readiness.

## 2026-09-24 — Review topology

Use three dependent stacked PRs: artifact contract; runtime reliability and resource
bounds; final clean-checkout/soak/CI evidence. The container command contract is a
synchronization boundary and is owned by the first layer.

## 2026-09-24 — Stable performance gates

Gate on canonical ticks, collection/payload/GPU capacities, lifecycle transitions,
and error-free agreement. Record environment-dependent timing and resource readings
as diagnostics only.

## 2026-09-24 — Release provenance and play surface

Reproducible means locked build inputs plus recorded source revision, OCI config IDs,
labels, sizes, and repository digests when available; it does not claim byte-identical
images across Docker builders. Release `created` metadata comes from an explicit
RFC3339 value tied to `SOURCE_DATE_EPOCH`, defaulting deterministically to the source
commit time.

Human play uses two container-owned headed Chromium processes exposed by noVNC on
ephemeral loopback ports. The host browser is only a remote display client. The
shipped authority and web images use fixed unprivileged identities, read-only roots,
all capabilities dropped, no-new-privileges, and explicit tmpfs paths.
