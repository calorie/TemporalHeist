# P5 decisions

## 2026-09-23 — Temporal Bridge semantics

Render the player's canonical trajectory from the Echo's source tick
`renderTick - 600` to the current human tick. This directly explains the fixed delay
and is completely reconstructible from the authority's 660-tick retained history.
Do not render a wake behind the Echo because reconnect bootstrap cannot guarantee
the additional older samples.

## 2026-09-23 — GPU ownership

JavaScript supplies bounded canonical segment endpoints and ages. WGSL owns ribbon
expansion, taper, edge falloff, temporal gradient, one-second knots, and the spawn
ring. Renderer output remains presentation-only.

## 2026-09-23 — Review topology

Use three dependent stacked PRs: pure temporal model; GPU pipeline and focused probe;
full mission/release evidence. Each layer must keep existing acceptance compatible.

## 2026-09-23 — Attempt and pulse continuity

Use `(room_epoch, room.attempt)` as the presentation continuity key and emit bridges
only for ACTIVE samples in that attempt. A restart within the same epoch must not
join old and new motion. Derive the 60-tick spawn pulse from the authoritative Echo
absent-to-present transition; suppress it when retained history begins with an Echo
already present so reconnect and late history cannot fabricate an event.

## 2026-09-23 — Segment capacity

Use a fixed capacity of 512 segments. A 600-tick window sampled at 20 Hz has 200
intervals per owner when aligned and can have 201 after both endpoints are clipped
inside sampling intervals, so two players require up to 402 records. Fail explicitly
instead of truncating if malformed or unexpectedly dense input exceeds capacity.

## 2026-09-23 — Persistent temporal GPU pass

Allocate the 512-record segment buffer and two-record pulse buffer once with the
renderer. JavaScript uploads only two `vec4` values per segment and one `vec4` per
pulse; WGSL expands those records into ribbon and ring triangles. Render opaque
geometry first, then render both temporal pipelines with alpha blending, the same
depth attachment, depth testing enabled, and depth writes disabled. This keeps
walls visually in front without letting transparent ribbons occlude each other
through depth writes.

The production renderer GPU probe replaces the standalone WebGPU spike. It runs
guard parity and temporal pixels through the real renderer and records adapter,
backend, both supported viewports, overflow behavior, and validation errors in one
container Chromium session.

## 2026-09-23 — Release evidence boundary

Expose a read-only presentation summary through the existing browser test API. The
summary is captured from the exact Temporal View already submitted to WebGPU and
includes owner endpoints/counts plus the renderer statistics from that frame. It
does not select, modify, or feed gameplay state. Full mission acceptance matches
the two clients by canonical render tick and proves identical bridge data and GPU
uploads without adding a protocol field or another route.

Reuse one screenshot slot from the successful mission for the Temporal Bridge scene.
Keep the live player separated from its Echo and store canonical metadata beside the
screenshot in `evidence.json`; pixel-level palette, occlusion, and pulse boundaries
remain the responsibility of the production renderer GPU probe.
