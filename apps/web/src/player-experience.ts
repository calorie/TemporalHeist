import type { Snapshot } from './generated/temporal_heist.ts';
import { type InteractionDecision, interactionDecision } from './interaction-decision.ts';
import type { Facility } from './map.ts';

export interface MissionStep {
  label: string;
  state: 'complete' | 'current' | 'upcoming';
}

export interface PlayerIdentity {
  self: string;
  partner: string;
  echoes: string[];
}

export interface PlayerExperience {
  identity: PlayerIdentity;
  steps: MissionStep[];
  interaction?: InteractionDecision;
}

export function playerExperience(
  facility: Pick<Facility, 'objective' | 'terminals'>,
  snapshot: Snapshot | undefined,
  playerId: number,
): PlayerExperience {
  const partnerId = playerId === 1 ? 2 : 1;
  const objectiveSecured = Boolean(snapshot?.room?.objectiveSecured);
  const doorOpen = Boolean(snapshot?.room?.echoOpenedFinalDoor);
  const extractionPlayers = snapshot?.room?.extractionPlayers ?? 0;
  return {
    identity: {
      self: `YOU · P${playerId}`,
      partner: `PARTNER · P${partnerId}`,
      echoes: (snapshot?.echoes ?? []).map((pose) =>
        pose.playerId === playerId
          ? `YOUR ECHO · P${playerId}`
          : `PARTNER ECHO · P${pose.playerId}`,
      ),
    },
    steps: [
      {
        label: 'Steal the vault data',
        state: objectiveSecured ? 'complete' : 'current',
      },
      {
        label: 'Open the final door with Echo Presence',
        state: doorOpen ? 'complete' : objectiveSecured ? 'current' : 'upcoming',
      },
      {
        label: `Reach extraction together${doorOpen ? ` (${extractionPlayers}/2)` : ''}`,
        state: doorOpen ? 'current' : 'upcoming',
      },
    ],
    interaction: interactionDecision(snapshot, playerId, facility),
  };
}
