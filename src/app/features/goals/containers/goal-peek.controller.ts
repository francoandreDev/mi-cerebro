import { computed, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { entitySlugSegment } from '@core/routing/entity-slug';

import type { Goal, GoalPriority, GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';

type PeekPatch = Partial<Pick<Goal, 'title' | 'completed' | 'deadline' | 'priority'>>;

// why: extraído de GoalsWallContainer (§4.4 límite duro de 300 líneas) — el
//      peek overlay del wall edita título/plazo/prioridad/completed/borrado
//      de una meta sin abrir el editor completo; agrupa ese CRUD chico en
//      una unidad aparte, mismo patrón de clase-plana-instanciada-en-
//      constructor que EntityLockController (core/locks/).
export class GoalPeekController {
  private readonly goalsService = inject(GoalsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly router = inject(Router);

  readonly goalId = signal<string | null>(null);

  constructor(
    private readonly summaries: Signal<readonly GoalSummary[]>,
    private readonly askConfirmRemove: (
      title: string,
      onAccept: () => void | Promise<void>,
    ) => void,
  ) {}

  readonly summary = computed<GoalSummary | null>(() => {
    const id = this.goalId();
    return id ? (this.summaries().find((s) => s.id === id) ?? null) : null;
  });

  open(id: string): void {
    this.goalId.set(id);
  }
  close(): void {
    this.goalId.set(null);
  }

  onTitleChange(title: string): void {
    void this.patch({ title });
  }
  onCompletedChange(completed: boolean): void {
    void this.patch({ completed });
  }
  onDeadlineChange(deadline: string | null): void {
    void this.patch({ deadline });
  }
  onPriorityChange(priority: GoalPriority): void {
    void this.patch({ priority });
  }

  async openMap(): Promise<void> {
    const id = this.goalId();
    if (!id) return;
    this.close();
    await this.router.navigate(['/goals', entitySlugSegment(this.titleOf(id), id)]);
  }

  remove(): void {
    const id = this.goalId();
    if (!id) return;
    this.askConfirmRemove(this.titleOf(id), async () => {
      try {
        await this.workspace.ensureWritable();
        await this.goalsService.deleteToTrash(id);
        this.close();
      } catch (e) {
        this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
      }
    });
  }

  private titleOf(id: string): string {
    return this.summaries().find((s) => s.id === id)?.title ?? '';
  }

  private async patch(partial: PeekPatch): Promise<void> {
    const id = this.goalId();
    if (!id) return;
    try {
      await this.workspace.ensureWritable();
      await this.goalsService.patch(id, partial);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
}
