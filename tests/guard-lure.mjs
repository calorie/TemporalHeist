import assert from 'node:assert/strict';
import facility from '../map/facility.json' with { type: 'json' };

export function assertGuardLure(snapshot, guard, echo) {
  assert(guard.investigationTarget);
  assert.equal(snapshot.serverTick - echo.sourceTick, 600);
  const elapsed = snapshot.serverTick - guard.stateEnteredTick;
  assert(elapsed >= 0);
  // The retained target comes from this investigation, possibly before a
  // 30-tick observation boundary or skipped publication. A live source moves
  // at most speedPerTick per axis, so elapsed authority ticks bound each axis.
  assert(Math.abs(guard.investigationTarget.xMm - echo.xMm) <= elapsed * facility.speedPerTick &&
    Math.abs(guard.investigationTarget.zMm - echo.zMm) <= elapsed * facility.speedPerTick,
  'guard target must match the Echo within its elapsed-tick movement bound');
}
