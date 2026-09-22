# P2 decisions

## 2026-09-23 — Guard behavior

Use one authority-owned guard with deterministic Patrol, Investigate, and Return
states. A visible live human fails the attempt. A visible first-generation Echo
records a last-seen target and causes investigation without failure. This makes
the established Echo mechanic a deliberate stealth tool while keeping gameplay
authority and replay semantics unchanged.

Use authored straight-line waypoint segments rather than general pathfinding.
This is sufficient for one readable encounter, keeps integer simulation and E2E
deterministic, and avoids building navigation infrastructure before the game needs
dynamic routes.

Human detection takes priority over Echo investigation on the same tick. Continuous
visibility of one Echo replay segment is deduplicated so it cannot hold the guard
in an indefinitely refreshed state. Restart restores all guard state.

