import assert from 'node:assert/strict';
import { map } from '../src/map.ts';
import { nearestActionTarget, objectivePrimitives } from '../src/objective-view.ts';

const presentation = (xMm, zMm, objectiveSecured = false) => ({
  snapshot: { room: { objectiveSecured } },
  live: [{ playerId: 1, xMm, zMm, sourceTick: 100 }],
  echoes: [],
  guards: [],
  renderTick: 100,
});

assert.equal(nearestActionTarget(map, presentation(21000, 4000), 1), 61);
assert.equal(nearestActionTarget(map, presentation(21750, 4000), 1), 61);
assert.equal(nearestActionTarget(map, presentation(21751, 4000), 1), undefined);
assert.equal(nearestActionTarget(map, presentation(2500, 6000), 1), 31);
assert.equal(nearestActionTarget(map, presentation(2500, 7001), 1), undefined);
assert.equal(
  nearestActionTarget(
    { ...map, objective: { ...map.objective, x: 3000, z: 6000 } },
    presentation(2600, 6000),
    1,
  ),
  31,
  'the closer action terminal wins when both targets are in range',
);
assert.equal(nearestActionTarget(map, presentation(21000, 4000, true), 1), undefined);
assert.equal(nearestActionTarget(map, presentation(21000, 4000), 2), undefined);

const [active] = objectivePrimitives(map, presentation(21000, 4000));
const [secured] = objectivePrimitives(map, presentation(21000, 4000, true));
assert.deepEqual([active.x, active.z], [21000, 4000]);
assert(active.color[1] > 0.7 && active.color[2] > 0.7, 'unsecured pedestal is cyan');
assert(secured.color[1] < active.color[1], 'secured pedestal dims on authority confirmation');
assert(secured.color[2] < active.color[2], 'secured pedestal loses cyan brightness');

console.log('objective view tests passed');
