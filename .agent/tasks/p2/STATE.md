# P2 state

## Status

Design and written specification are approved. The implementation plan is complete
and contract implementation is next.

## Completed

- Selected an authority-owned Patrol → Investigate → Return guard state machine.
- Defined live-human failure and non-failing Echo investigation semantics.
- Preserved the exact 600-tick, one-generation canonical Echo model.
- Defined the contract-first and container-only verification boundaries.

## Verification

No implementation verification has run. This commit contains design and durable
task state only.

## Blockers

None.

## Next action

Implement and container-verify the shared protocol/map contract, commit the frozen
boundary, then begin isolated parallel component implementation.
