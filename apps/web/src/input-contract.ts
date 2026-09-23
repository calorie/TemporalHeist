export type KeyboardCommand = 'movement' | 'action' | 'ready' | 'restart';
export interface KeyboardDecision {
  consume: boolean;
  command?: KeyboardCommand;
}

const LOBBY = 1;
const ACTIVE = 2;
const WON = 3;
const FAILED = 4;
const movementKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
]);

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName)
  );
}

export function keyboardDecision(
  key: string,
  phase: number | undefined,
  interactiveTarget: boolean,
  repeat: boolean,
): KeyboardDecision {
  if (interactiveTarget) return { consume: false };
  const normalized = key.toLowerCase();
  if (phase === ACTIVE && movementKeys.has(normalized))
    return { consume: true, command: 'movement' };
  if (phase === ACTIVE && normalized === 'e')
    return repeat ? { consume: true } : { consume: true, command: 'action' };
  if (phase === LOBBY && key === 'Enter')
    return repeat ? { consume: true } : { consume: true, command: 'ready' };
  if ((phase === WON || phase === FAILED) && normalized === 'r')
    return repeat ? { consume: true } : { consume: true, command: 'restart' };
  return { consume: false };
}
