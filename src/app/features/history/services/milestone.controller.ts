// Owns the UI flow around creating, renaming, deleting and moving
// milestones from /history. Splits out of HistoryContainer because the
// collision flow (with the "use other / move / cancel" branch) doubles
// the size of the container otherwise. The controller is provided at the
// container level (not root) so the busy signal scopes to that screen.

import { Injectable, inject, signal } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { MilestoneService } from '@core/versioning/milestone.service';
import { VariantsService } from '@core/versioning/variants.service';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';

import { facetOf, type Facet } from './facet';
import { HistoryService } from './history.service';
import type { MilestoneEntry } from './history.types';

export interface MilestoneCollision {
  readonly existing: MilestoneEntry;
  readonly targetOid: string;
  readonly attemptedName: string;
  readonly facet: Facet | null;
}

@Injectable()
export class MilestoneController {
  private readonly milestoneService = inject(MilestoneService);
  private readonly variants = inject(VariantsService);
  private readonly history = inject(HistoryService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  private readonly busySignal = signal(false);
  readonly busy = this.busySignal.asReadonly();
  // why: no template propio — HistoryContainer, dueño del template que
  //      renderiza las acciones de milestone, lee este controller y bindea
  //      el <mc-confirm-dialog> en su propia plantilla.
  readonly confirm = new ConfirmController();

  // why: name/rename/collision inputs are collected inline in
  //      HistoryContainer's own template (no native prompt()) — this signal
  //      is what drives that inline collision panel; container reads it and
  //      calls resolveUseOther/resolveMoveHere/cancelCollision.
  private readonly collisionSignal = signal<MilestoneCollision | null>(null);
  readonly collision = this.collisionSignal.asReadonly();

  async mark(oid: string, message: string, name: string, description?: string): Promise<void> {
    if (this.busySignal()) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    await this.attemptCreate(oid, trimmed, description?.trim() || undefined, facetOf(message));
  }

  async rename(m: MilestoneEntry, nextName: string): Promise<void> {
    if (this.busySignal()) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === m.name) return;
    this.busySignal.set(true);
    try {
      const result = await this.milestoneService.rename(m.name, trimmed);
      if (result.status === 'renamed') {
        await this.history.refreshMilestones();
        return;
      }
      this.collisionSignal.set({
        existing: result.existing,
        targetOid: m.oid,
        attemptedName: trimmed,
        facet: null,
      });
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busySignal.set(false);
    }
  }

  async resolveUseOther(newName: string): Promise<void> {
    const c = this.collisionSignal();
    if (!c) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    this.collisionSignal.set(null);
    // why: mark → compact, rename → plain create (no facet context).
    if (c.facet !== null) {
      await this.attemptCreate(c.targetOid, trimmed, undefined, c.facet);
      return;
    }
    this.busySignal.set(true);
    try {
      await this.milestoneService.create(c.targetOid, trimmed);
      await this.history.refreshMilestones();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busySignal.set(false);
    }
  }

  async resolveMoveHere(): Promise<void> {
    const c = this.collisionSignal();
    if (!c) return;
    this.collisionSignal.set(null);
    this.busySignal.set(true);
    try {
      await this.milestoneService.moveTo(c.existing.name, c.targetOid);
      await this.history.refreshMilestones();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busySignal.set(false);
    }
  }

  cancelCollision(): void {
    this.collisionSignal.set(null);
  }

  delete(m: MilestoneEntry): void {
    if (this.busySignal()) return;
    this.confirm.ask(
      {
        title: this.i18n.t('versioning.history.milestone.confirm.delete.title'),
        message: this.i18n.t('versioning.history.milestone.deleteConfirm', { name: m.name }),
        confirmLabel: this.i18n.t('versioning.history.milestone.confirm.delete.confirm'),
        cancelLabel: this.i18n.t('versioning.history.milestone.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        this.busySignal.set(true);
        try {
          await this.milestoneService.delete(m.name);
          await this.history.refreshMilestones();
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.busySignal.set(false);
        }
      },
    );
  }

  private async attemptCreate(
    oid: string,
    name: string,
    description: string | undefined,
    facet: Facet,
  ): Promise<void> {
    this.busySignal.set(true);
    try {
      const ref = this.refFor(facet);
      const result = ref
        ? await this.milestoneService.createAndCompact(oid, name, description, ref)
        : await this.milestoneService.create(oid, name, description);
      if (result.status === 'created') {
        // why: si hubo rewrite, la ventana de commits corriente puede
        //      referirse a oids que ya no existen. `history.load()` refetchea;
        //      si no hubo rewrite, un refresh de milestones alcanza.
        if ('rewrote' in result && result.rewrote) {
          await this.history.load();
        } else {
          await this.history.refreshMilestones();
        }
        return;
      }
      this.collisionSignal.set({
        existing: result.existing,
        targetOid: oid,
        attemptedName: name,
        facet,
      });
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busySignal.set(false);
    }
  }

  private refFor(facet: Facet): string | null {
    const active = this.variants.getActive();
    if (!active) return null;
    const raw =
      facet === 'main'
        ? active.refs.main
        : facet === 'draft'
          ? active.refs.draft
          : active.refs.comments;
    return stripHeadsPrefix(raw);
  }
}
