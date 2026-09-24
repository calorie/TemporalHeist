# Local demo Release Candidate design

The RC is distributed as a Docker Compose project for local evaluation. The shipped
roles are the digest-pinned official relay plus named authority and static-web images.
Container-owned Chromium remains the playable inspection surface and is not part of
the shipped server images.

The wrapper derives source revision/version metadata through Git and passes it only as
image build metadata. A release manifest records the resulting immutable image IDs,
RepoDigests when available, sizes, OCI labels, and source revision. Runtime images run
as non-root and read-only; writable paths are explicit tmpfs or named volumes.

Runtime readiness separates process liveness from usable service state. Web has an
exact health endpoint, relay has a transport-level probe, and authority exposes HTTP
`/healthz` for process liveness plus `/readyz` for an advancing simulation with an
active relay publication path. Relay outage keeps liveness healthy while readiness
transitions ready → unready → ready. JSON logs
identify room/epoch and lifecycle transitions. SIGTERM triggers coordinated shutdown.

Reliability evidence injects relay and authority restarts into containerized clients,
then runs a fixed-canonical-tick soak and resource-bound tests. CI exports versioned
evidence before deleting Compose volumes. Public TLS, ingress, and authentication are
explicitly deferred.

The resource contract runs 216,000 virtual ticks and gates the 3,601-tick simulation
history, 660-tick network history, 1,024 pending-input queue, 4,096-byte input frame,
1,400-sample browser timeline, 512 Temporal Bridge segments, and two temporal pulses.
Snapshot/history maximum encoded byte counts are recorded and bounded by constants
set from measured protocol data rather than wall-clock resource readings.

Evidence schema v1 records source SHA, image config IDs, optional repository digests,
OCI labels, Compose project/resource IDs, room epochs and tick ranges, lifecycle and
reconnect events, resource/payload maxima, WebGPU adapter/backend, browser errors,
and screenshot paths. CI orders component verification before full acceptance, then
release/manual-only restart soak and two-stack isolation. Evidence-producing jobs
upload artifacts with `if: always()` before stack cleanup.
