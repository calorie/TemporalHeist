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
reset also respawns both connected players and clears transient gameplay state.
