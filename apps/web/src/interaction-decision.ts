import type { Snapshot } from './generated/temporal_heist.ts';
import type { Facility } from './map.ts';

const ACTIVE = 2;

export interface InteractionDecision {
  targetId: number;
  label: string;
  key: 'E';
}

/** Derives local affordance from the latest canonical pose. Authority still validates the action. */
export function interactionDecision(
  snapshot: Snapshot | undefined,
  playerId: number,
  facility: Pick<Facility, 'objective' | 'terminals'>,
): InteractionDecision | undefined {
  if (snapshot?.room?.phase !== ACTIVE) return undefined;
  const player = snapshot.players.find((pose) => pose.playerId === playerId && !pose.echo);
  if (!player) return undefined;
  const candidates: { id: number; x: number; z: number; radius: number; label: string }[] =
    facility.terminals
      .filter(({ capability }) => capability === 'Action')
      .map((target) => ({ ...target, radius: 1000, label: 'ACTIVATE TERMINAL' }));
  if (!snapshot.room.objectiveSecured)
    candidates.push({ ...facility.objective, label: 'STEAL VAULT DATA' });
  const target = candidates
    .map((candidate) => ({
      ...candidate,
      distance: Math.hypot(candidate.x - player.xMm, candidate.z - player.zMm),
    }))
    .filter((candidate) => candidate.distance <= candidate.radius)
    .sort((left, right) => left.distance - right.distance)[0];
  return target ? { targetId: target.id, label: target.label, key: 'E' } : undefined;
}
