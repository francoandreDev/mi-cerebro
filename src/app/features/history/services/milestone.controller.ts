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

  async mark(oid: string, message: string): Promise<void> {
    if (this.busySignal()) return;
    const name = window.prompt(this.i18n.t('versioning.history.milestone.namePrompt'));
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const description = window.prompt(
      this.i18n.t('versioning.history.milestone.descriptionPrompt'),
    );
    await this.attemptCreate(oid, trimmed, description ?? undefined, facetOf(message));
  }

  async rename(m: MilestoneEntry): Promise<void> {
    if (this.busySignal()) return;
    const next = window.prompt(
      this.i18n.t('versioning.history.milestone.renamePrompt', { name: m.name }),
      m.name,
    );
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === m.name) return;
    this.busySignal.set(true);
    try {
      const result = await this.milestoneService.rename(m.name, trimmed);
      if (result.status === 'renamed') {
        await this.history.refreshMilestones();
        return;
      }
      await this.resolveCollision(result.existing, m.oid, trimmed, null);
      await this.history.refreshMilestones();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busySignal.set(false);
    }
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
      await this.resolveCollision(result.existing, oid, name, facet);
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

  // Existing milestone with the requested name already points at some
  // other commit. Offer three options: use a different name, move the
  // existing milestone to the new target, or cancel.
  private async resolveCollision(
    existing: MilestoneEntry,
    targetOid: string,
    attemptedName: string,
    facet: Facet | null,
  ): Promise<void> {
    const existingShort = existing.oid.slice(0, 7);
    const choice = window.prompt(
      `${this.i18n.t('versioning.history.milestone.collisionTitle', { name: attemptedName })}\n` +
        `${this.i18n.t('versioning.history.milestone.collisionBody', { shortOid: existingShort })}\n\n` +
        `1) ${this.i18n.t('versioning.history.milestone.collisionUseOther')}\n` +
        `2) ${this.i18n.t('versioning.history.milestone.collisionMoveHere')}\n` +
        `3) ${this.i18n.t('versioning.history.milestone.collisionCancel')}\n\n` +
        '1 / 2 / 3:',
    );
    if (choice === null) return;
    const trimmed = choice.trim();
    if (trimmed === '1') {
      const newName = window.prompt(this.i18n.t('versioning.history.milestone.namePrompt'));
      if (newName === null) return;
      const t = newName.trim();
      if (!t) return;
      // why: mark → compact, rename → plain create (no facet context).
      if (facet !== null) {
        await this.attemptCreate(targetOid, t, undefined, facet);
      } else {
        await this.milestoneService.create(targetOid, t);
        await this.history.refreshMilestones();
      }
    } else if (trimmed === '2') {
      await this.milestoneService.moveTo(existing.name, targetOid);
      await this.history.refreshMilestones();
    }
  }
}
