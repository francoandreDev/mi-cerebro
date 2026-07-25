import type { TutorialStep } from '@core/tutorials/tutorial.types';

// why: turns an action's key/ctrlOrMeta/shiftKey into the little keycap
//      chips rendered near the card — one visual source of truth instead
//      of each tutorial spelling out "Ctrl+K" in prose.
const KEY_DISPLAY: Readonly<Record<string, string>> = {
  arrowright: '→',
  arrowleft: '←',
  arrowup: '↑',
  arrowdown: '↓',
  enter: 'Enter',
  escape: 'Esc',
  ' ': 'Espacio',
};

export const keyLabelsFor = (action: NonNullable<TutorialStep['action']>): readonly string[] => {
  if (action.event !== 'keydown') return [];
  const labels: string[] = [];
  if (action.ctrlOrMeta) labels.push('Ctrl');
  if (action.altKey) labels.push('Alt');
  if (action.shiftKey) labels.push('Shift');
  if (action.key) {
    const lower = action.key.toLowerCase();
    labels.push(
      KEY_DISPLAY[lower] ?? (action.key.length === 1 ? action.key.toUpperCase() : action.key),
    );
  }
  return labels;
};

const matchesKeydown = (
  action: NonNullable<TutorialStep['action']>,
  event: KeyboardEvent,
): boolean => {
  if (action.key && event.key.toLowerCase() !== action.key.toLowerCase()) return false;
  if (action.ctrlOrMeta && !(event.ctrlKey || event.metaKey)) return false;
  if (action.shiftKey && !event.shiftKey) return false;
  if (action.altKey && !event.altKey) return false;
  return true;
};

export const matchesAction = (
  action: NonNullable<TutorialStep['action']>,
  event: Event,
  selector: string,
): boolean =>
  action.event === 'keydown'
    ? matchesKeydown(action, event as KeyboardEvent)
    : !!(event.target as Element | null)?.closest(selector);
