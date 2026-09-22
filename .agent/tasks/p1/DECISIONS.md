# P1 decisions

## 2026-09-22 — Execution policy

Use agentic-engineering 0.5.2 as the sole orchestration policy. Use Superpowers
TDD, systematic debugging, and verification where useful, but do not apply its
per-stage approval pauses because the user explicitly authorized autonomous P1
work and asked that reversible details never stall progress.

When details are unspecified, select the smallest reversible behavior compatible
with existing invariants, record it here, implement it, and verify it. A routine
test failure is a debugging task rather than a product decision.

## 2026-09-22 — P1 decomposition

Build the authority-owned session loop before stealth content. This creates a
playable start/end/retry structure that every later hazard and presentation
feature can reuse and test independently.

## 2026-09-22 — P1.1 rules

- Additive protocol-major-1 fields carry readiness and authoritative room state.
- Both connected players must send Ready before an attempt starts.
- The attempt limit is five authority minutes (18,000 ticks).
- Winning requires both live players in the extraction zone and proof that Echo
  Presence opened the final door during that attempt.
- A reset returns the room to lobby, clears attempt history and transient state,
  respawns connected players, and requires readiness again.
- One connected player may request reset after won/failed; reset is unavailable
  during an active attempt to avoid unilateral griefing.

## 2026-09-22 — Inactive phases freeze gameplay

Lobby and terminal phases accept connection, readiness, restart, and heartbeat
inputs but do not advance movement, history, actions, Echoes, or mechanisms. This
prevents pre-positioning before an attempt and keeps the authoritative result
stable while players read it. Starting an attempt clears prior motion history;
it also zeroes any motion intent sent while waiting so held lobby input cannot
move a player on the start tick. Reset respawns both connected players and clears
transient gameplay state.

## 2026-09-22 — P1.2 surveillance semantics

Use one static authority-owned camera with an integer triangular view cone. This
is the smallest deterministic stealth pressure that is visible, avoidable, and
testable without introducing guard pathfinding or a second timing system.

Only current live humans trigger detection. Echoes remain historical projections
and do not fail stealth. Detection is immediate on the authority tick, records the
camera and player IDs, and enters the existing FAILED/restart flow. The camera is
placed in an optional side lane in zone 1 so the established Echo solution remains
valid along the central route.

## 2026-09-22 — P1.2 WebGPU telegraph verification

Map world height into WebGPU clip depth with `z = 0.8 - y / 2500`, which keeps
the facility, actors, and the raised surveillance wedge inside WebGPU's `0..w`
depth range. The E2E harness verifies the rendered warning through a one-pixel
surface readback at a stable point inside the cone: green dominates while idle
and red dominates after authoritative detection. This supplements screenshots
with a deterministic assertion against the actual containerized GPU output.

## 2026-09-22 — Parallel CI verification

Run component verification and full-stack acceptance as independent GitHub jobs
with unique Compose namespaces. Both still invoke the repository `container`
entry point and clean their own networks and volumes. Parallel jobs reduce wall
time from the sum of two cold container builds to the slower job, and workflow
concurrency cancels obsolete runs for superseded commits.

## 2026-09-22 — P1.3 presentation boundary

Keep P1.3 entirely client-side. Derive onboarding, the first-Echo countdown,
feedback transitions, and extraction presentation from existing authoritative
snapshots and facility geometry. Use the browser Web Audio API for short synthesized
cues and raw WebGPU primitives for extraction and state feedback. Add no protocol,
simulation, map-data, UI-framework, audio-file, or renderer-authority dependency.

Automated acceptance must exercise visible ready/restart controls and assert the
human-facing UI; test-only state remains an oracle for deterministic movement and
authority timing. Manual visual mode opens both player pages in containerized
Chromium and preserves labeled evidence before stack cleanup.

## 2026-09-23 — P1.3 browser isolation and E2E movement

Run visual player A and B as separate Compose services. Each has its own
persistent-profile volume and ephemeral CDP host port while sharing only the
room data plane and read-only application inputs. The visual checker runs inside
each browser container and requires its screenshot, metadata, raw WebGPU backend,
adapter identity, and empty renderer/page error list.

The browser E2E records plate occupancy long enough for cold software-GPU CI and
moves the other player through the first two gates while live presence holds
them. It reserves the final gate for the required proof: player B crosses while
player A's exact 600-tick Echo supplies Presence. Camera detection approaches
the cone laterally from an outside waypoint so delayed movement messages cannot
trigger the terminal state before the assertion begins.

## 2026-09-23 — P1.4 release isolation

Release isolation uses two distinct Git worktrees and production `acceptance`
stacks. Both stacks and all four Chromium clients are brought up together. On
software-GPU hosts, stack B pauses only its presentation loop for four minutes
after WebGPU initialization and room connection while stack A runs; B then resumes
and runs the same complete scenario. This retains simultaneous process, profile,
network, volume, certificate, and connection coverage without making two llvmpipe
render loops compete strongly enough to starve reliable input observation.

The harness fails unless both acceptance runs pass, resources are disjoint, no
host ports are published, and deleting stack A with all volumes leaves stack B's
resource IDs and in-network health unchanged.
