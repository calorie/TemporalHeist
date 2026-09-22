# P2 state

## Status

Design approved in conversation. Written design and task contract are ready for
review before implementation planning.

## Completed

- Selected an authority-owned Patrol → Investigate → Return guard state machine.
- Defined live-human failure and non-failing Echo investigation semantics.
- Preserved the exact 600-tick, one-generation canonical Echo model.
- Defined the contract-first and container-only verification boundaries.

## Verification

No implementation verification has run. This commit contains design and durable
task state only.

## Blockers

Written-spec review is the current process gate.

## Next action

After written-spec approval, create the implementation plan, freeze the shared
protocol/map contract, and begin isolated parallel component implementation.

