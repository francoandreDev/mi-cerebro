// PROYECTO.md §12 "Disparo por milestone" — pure planner para la variante
// disparada por el usuario al marcar un hito. A diferencia del planner por
// edad, esta pasada:
//   - opera sobre un rango acotado [milestone previo (o root) .. milestoneOid],
//   - es age-agnóstica (marcar un hito es un opt-in explícito para limpiar
//     lo previo aunque sea reciente),
//   - respeta las barreras internas (`before-restore:`, `Merge-Group:`) —
//     parten el rango en subgrupos,
//   - sólo el subgrupo que termina exactamente en el milestone hereda el
//     nombre; el resto vuelve a `auto-batch [...]`.
//
// Sin FS, sin isomorphic-git. Se compone con la CompactionService existente
// vía FuseGroup.label.

import type { CompactionPlan, FuseGroup } from './compaction-plan';
import type { CommitSummary } from './versioning.service';

export interface MilestoneCompactionPlanInput {
  // Newest-first, log completo de la rama.
  readonly commits: readonly CommitSummary[];
  // Oids que YA tienen tag (excluyendo el que estamos por crear — el rango
  // corta en el primer tag hacia atrás, y ése no puede ser el milestone
  // recién marcado).
  readonly tagOids: ReadonlySet<string>;
  readonly milestoneOid: string;
  // Slug del milestone que se usa como subject del commit compactado final.
  readonly milestoneLabel: string;
}

export function buildMilestoneCompactionPlan(input: MilestoneCompactionPlanInput): CompactionPlan {
  // Reverse: oldest → newest.
  const ordered = [...input.commits].reverse();
  const milestoneIdx = ordered.findIndex((c) => c.oid === input.milestoneOid);
  if (milestoneIdx < 0) {
    return { fuseGroups: [], preservedOids: ordered.map((c) => c.oid) };
  }

  // Frontera hacia atrás: sólo un tag ajeno (previous milestone) frena.
  // Las barreras internas (before-restore, Merge-Group) NO frenan hacia
  // atrás — parten el rango en subgrupos, pero el rango se sigue
  // extendiendo hasta el milestone previo (o root). Ver §12 "Disparo por
  // milestone": "el resultado son uno o más commits compactados, y sólo
  // el que termina exactamente en el milestone hereda el nombre; los
  // demás vuelven a `auto-batch [...]`".
  let previousMilestoneIdx = -1;
  for (let i = milestoneIdx - 1; i >= 0; i--) {
    if (input.tagOids.has(ordered[i]!.oid)) {
      previousMilestoneIdx = i;
      break;
    }
  }

  const rangeStart = previousMilestoneIdx + 1;
  const rangeEnd = milestoneIdx;

  // Dentro del rango, parten en subgrupos por barreras internas
  // (before-restore, Merge-Group). Los tags no aparecen porque
  // previousBarrierIdx ya cortó en el primero.
  const fuseGroups: FuseGroup[] = [];
  const preservedOids: string[] = [];

  // Preservar todo lo que queda afuera del rango.
  for (let i = 0; i < rangeStart; i++) preservedOids.push(ordered[i]!.oid);
  for (let i = rangeEnd + 1; i < ordered.length; i++) preservedOids.push(ordered[i]!.oid);

  let currentGroup: string[] = [];
  const flushGroup = (isTerminal: boolean): void => {
    if (currentGroup.length === 0) return;
    if (currentGroup.length === 1 && !isTerminal) {
      preservedOids.push(currentGroup[0]!);
      currentGroup = [];
      return;
    }
    fuseGroups.push({
      bucket: 'daily',
      bucketKey: '',
      oids: [...currentGroup],
      newestTimestamp: 0,
      ...(isTerminal ? { label: input.milestoneLabel } : {}),
    });
    currentGroup = [];
  };

  for (let i = rangeStart; i <= rangeEnd; i++) {
    const commit = ordered[i]!;
    if (i < rangeEnd && isInternalBarrier(commit)) {
      flushGroup(false);
      preservedOids.push(commit.oid);
      continue;
    }
    currentGroup.push(commit.oid);
  }
  flushGroup(true);

  return { fuseGroups, preservedOids };
}

function isInternalBarrier(commit: CommitSummary): boolean {
  if (commit.message.startsWith('before-restore:')) return true;
  if (/^Merge-Group:/m.test(commit.message)) return true;
  return false;
}
