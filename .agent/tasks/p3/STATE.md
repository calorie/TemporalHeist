# P3 state

## Status

Architectural design is approved. The first stack layer, the additive P3.1
contract/map, is implemented and verified on `p3/contract-map`. Its exact code
revision is `12ea6e87e6361d8b0b74e1fb09bb658012917536`.

## Completed

- Selected a dependent four-layer GitHub PR stack for the full P3 objective.
- Chose one authority-owned team objective rather than inventory or generic loot.
- Chose live-human-only `ACTION` at a vault terminal; Echo Action cannot steal.
- Completed read-only product, contract, client, and E2E audits.
- Wrote the P3 design and stable task acceptance criteria.
- Wrote the detailed contract, authority, client, and full-E2E implementation
  plan with exact container commands and stack boundaries.
- Added `RoomState.objective_secured` field 12 with a legacy `false` default and
  regenerated the TypeScript binding.
- Authored vault objective 61 at `(21000, 4000)` with radius 750 mm and added
  Rust deserialization, bounds/radius/target-ID validation, and browser map type.
- Documented the live-human-only contract and compatibility semantics.

## Verification

- Design self-review passed: no placeholders, contradictory ownership, ambiguous
  Echo capability, or scope outside the single mission loop remains.
- Plan self-review passed: every design requirement maps to a task, shared types
  and IDs agree across layers, and the five review-focus cases have owning tests.
- TDD red: `sh container p3-t1-protocol-red run --rm dev sh -lc 'npm ci >/dev/null && sh spikes/protocol/check.sh'` failed with missing Rust `objective_secured` field (E0609, E0560).
- TDD red: `sh container p3-t1-map-red run --rm dev cargo test -p th-sim objective_map_contract -- --exact` failed with missing `Map.objective` field (E0609). The separate objective validation check also failed before implementation because `validate_objective` and `Map.objective` were absent.
- Focused green: `sh container p3-t1-contract run --rm dev cargo test -p th-sim objective_map_contract -- --exact` passed 1 test; `sh container p3-t1-contract run --rm dev cargo test -p th-sim objective_validation` passed 1 test. `sh container p3-t1-contract run --rm dev sh -lc 'npm ci >/dev/null && sh spikes/protocol/check.sh'` passed, including Rust-to-TypeScript `true` and TypeScript-to-Rust absent-field `false` decoding.
- Full green: `sh container p3-t1-contract verify` passed codegen comparison, protocol spike, Rust format and Clippy, 43 Rust unit tests (8 authority, 35 sim), TypeScript, Biome (13 files), browser contract scripts, Vite, and WebGPU with zero shader/validation errors.
- `git diff --check` passed. `p3-t1-protocol-red`, `p3-t1-map-red`, and `p3-t1-contract` were each stopped with `down --volumes --remove-orphans`; all associated volumes and networks were removed.

## Next action

Proceed with the dependent authority mission layer on the existing four-layer
stack. The next branch is owned by the P3 coordinator; no upper-layer behavior
was implemented in this contract revision.
