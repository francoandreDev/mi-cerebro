// §20b: garantiza que idToPath/idToLoc de todos los servicios de entidad
// estén poblados antes de activar una ruta de detalle, sin depender de que
// WorkspaceSidebarContainer haya alcanzado a construirse primero (la
// condición de carrera real detrás del bug de reload de §20).

import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { ResolveFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

import { WorkspaceRefreshService } from './workspace-refresh.service';
import { WorkspaceService } from './workspace.service';
import type { WorkspaceState } from './workspace.types';

const SETTLED_STATES: ReadonlySet<WorkspaceState> = new Set([
  'ready',
  'unsupported',
  'needs-root',
  'needs-permission',
  'foreign-folder',
]);

export const entityReadyResolver: ResolveFn<boolean> = async () => {
  const workspace = inject(WorkspaceService);
  const workspaceRefresh = inject(WorkspaceRefreshService);
  const settled = await firstValueFrom(
    toObservable(workspace.state).pipe(filter((state) => SETTLED_STATES.has(state))),
  );
  if (settled !== 'ready') return true;
  try {
    await workspaceRefresh.ensureReady();
  } catch {
    /* deja que las lecturas propias del container muestren el error real,
       igual que pasaba antes de que este resolver existiera */
  }
  return true;
};
