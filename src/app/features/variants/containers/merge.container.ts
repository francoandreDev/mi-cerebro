// 13b-iv #2 — Merge between two variant families (limited to `main`).
// The page reads `from` and `into` from the URL, asks MergeService for
// the diff, and shows a per-entity table where the user picks one side
// or skip. Applying the selections is task #26.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { MergeService } from '@core/versioning/merge.service';
import type {
  MergeChoice,
  MergeDiffEntry,
  MergeFacetOptions,
  MergeOutcome,
  MergePlan,
  MergeSelection,
} from '@core/versioning/merge.types';
import { RemoteService } from '@core/versioning/remote.service';
import { VariantsService } from '@core/versioning/variants.service';
import type { Variant } from '@core/versioning/variants.types';

import { registerVariantsMergeTutorial } from './variants-merge.tutorial';

@Component({
  selector: 'mc-variants-merge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, McDatePipe],
  templateUrl: './merge.container.html',
  styleUrl: './merge.container.css',
})
export class MergeContainer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly variants = inject(VariantsService);
  private readonly merge = inject(MergeService);
  private readonly remote = inject(RemoteService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);

  protected readonly file = this.variants.file;
  protected readonly loading = signal(false);
  protected readonly applying = signal(false);
  protected readonly plan = signal<MergePlan | null>(null);
  protected readonly selections = signal<Map<string, MergeChoice>>(new Map());
  protected readonly outcome = signal<MergeOutcome | null>(null);
  // why: granularidad por faceta (docs/deferred.priority-order.md) — antes
  //      comentarios y borrador viajaban siempre junto al contenido
  //      principal en cada selección "from". No hay diff por-entidad de
  //      estas facetas (no se listan en el plan), así que el control es un
  //      toggle global por corrida de merge, no por fila — sólo aplica a
  //      merges variant→variant, un remote nunca mergeó estas facetas.
  protected readonly includeComments = signal(true);
  protected readonly includeDraft = signal(true);
  // 13e-iii — when set, "from" is a remote tracking ref instead of a variant.
  protected readonly remoteRefName = signal<string | null>(null);
  // why: fed back to /variants as a queryParam so the delta can play the
  //      confluence animation on the arm that just merged. Only set for
  //      variant→variant merges (not remote sources) and only when the
  //      last apply had no conflict.
  private lastMergedFromId: string | null = null;

  protected readonly from = computed(() => this.findVariant(this.fromId()));
  protected readonly into = computed(() => this.findVariant(this.intoId()));
  protected readonly isRemoteSource = computed(() => this.remoteRefName() !== null);
  protected readonly fromLabel = computed(() => {
    const ref = this.remoteRefName();
    if (ref) return this.i18n.t('merge.remote.label', { ref });
    return this.from()?.name ?? '';
  });

  protected readonly fromId = signal('');
  protected readonly intoId = signal('');

  protected readonly allVariants = computed(() =>
    [...this.file().variants]
      .filter((v) => !v.pendingDelete)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly counts = computed(() => {
    const map = this.selections();
    let from = 0;
    let into = 0;
    let skip = 0;
    for (const choice of map.values()) {
      if (choice === 'from') from++;
      else if (choice === 'into') into++;
      else skip++;
    }
    return { from, into, skip, total: map.size };
  });

  constructor() {
    registerVariantsMergeTutorial();
  }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const incoming = params.get('incoming');
    const intoParam = params.get('into') ?? '';
    this.intoId.set(intoParam);
    if (incoming === 'remote') {
      const ref = params.get('ref');
      this.remoteRefName.set(ref && ref.length > 0 ? ref : null);
      this.fromId.set('');
    } else {
      this.remoteRefName.set(null);
      this.fromId.set(params.get('from') ?? '');
    }
    await this.loadPlan();
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected async loadPlan(): Promise<void> {
    const into = this.into();
    if (!into) {
      this.plan.set(null);
      return;
    }
    const remoteRef = this.remoteRefName();
    if (!remoteRef) {
      const from = this.from();
      if (!from || from.id === into.id) {
        this.plan.set(null);
        return;
      }
    }
    this.loading.set(true);
    try {
      const result = remoteRef
        ? await this.merge.diffAgainstRemoteMain(into, remoteRef)
        : await this.merge.diffMains(this.from()!, into);
      this.plan.set(result);
      const initial = new Map<string, MergeChoice>();
      for (const entry of result.entries) initial.set(entry.filepath, 'from');
      this.selections.set(initial);
    } catch (e) {
      this.errors.report(e);
      this.plan.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected choiceFor(entry: MergeDiffEntry): MergeChoice {
    return this.selections().get(entry.filepath) ?? 'from';
  }

  protected setChoice(entry: MergeDiffEntry, choice: MergeChoice): void {
    const next = new Map(this.selections());
    next.set(entry.filepath, choice);
    this.selections.set(next);
  }

  protected applyAll(choice: MergeChoice): void {
    const current = this.plan();
    if (!current) return;
    const next = new Map<string, MergeChoice>();
    for (const entry of current.entries) next.set(entry.filepath, choice);
    this.selections.set(next);
  }

  protected statusLabel(entry: MergeDiffEntry): string {
    switch (entry.status) {
      case 'modified':
        return this.t('merge.status.modified');
      case 'only-in-from':
        return this.t('merge.status.onlyInFrom');
      case 'only-in-into':
        return this.t('merge.status.onlyInInto');
    }
  }

  protected async onFromChange(id: string): Promise<void> {
    this.fromId.set(id);
    this.syncUrl();
    await this.loadPlan();
  }

  protected async onIntoChange(id: string): Promise<void> {
    this.intoId.set(id);
    this.syncUrl();
    await this.loadPlan();
  }

  protected async swapSides(): Promise<void> {
    const f = this.fromId();
    const i = this.intoId();
    this.fromId.set(i);
    this.intoId.set(f);
    this.syncUrl();
    await this.loadPlan();
  }

  protected async applyMerge(): Promise<void> {
    const current = this.plan();
    if (!current) return;
    const selections: MergeSelection[] = current.entries.map((e) => ({
      filepath: e.filepath,
      choice: this.choiceFor(e),
    }));
    await this.runApply(current, selections);
  }

  protected async retryFailed(): Promise<void> {
    const current = this.plan();
    const failedAt = this.outcome()?.failedAt;
    if (!current || !failedAt) return;
    await this.runApply(current, [{ filepath: failedAt.path, choice: 'from' }]);
  }

  protected async skipAndContinue(): Promise<void> {
    const current = this.plan();
    const remaining = this.outcome()?.remaining ?? [];
    if (!current || remaining.length === 0) return;
    const sels = remaining.map<MergeSelection>((p) => ({ filepath: p, choice: 'from' }));
    await this.runApply(current, sels);
  }

  private async runApply(plan: MergePlan, selections: readonly MergeSelection[]): Promise<void> {
    if (this.applying()) return;
    if (!selections.some((s) => s.choice === 'from')) return;
    this.applying.set(true);
    try {
      const remoteRef = this.remoteRefName();
      const into = this.into();
      const facets: MergeFacetOptions = {
        comments: this.includeComments(),
        draft: this.includeDraft(),
      };
      const result =
        remoteRef && into
          ? await this.merge.applyFromRemoteMainSelections(into, remoteRef, selections)
          : await this.merge.apply(plan, selections, facets);
      this.outcome.set(result);
      if (remoteRef && result.failedAt === null) this.remote.clearDivergence();
      if (!remoteRef && result.failedAt === null) this.lastMergedFromId = this.fromId();
      await this.loadPlan();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.applying.set(false);
    }
  }

  protected dismissOutcome(): void {
    this.outcome.set(null);
  }

  protected back(): void {
    const justMerged = this.lastMergedFromId;
    if (justMerged) {
      void this.router.navigate(['/variants'], { queryParams: { justMerged } });
    } else {
      void this.router.navigate(['/variants']);
    }
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.fromId(), into: this.intoId() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private findVariant(id: string): Variant | null {
    if (!id) return null;
    return this.file().variants.find((v) => v.id === id) ?? null;
  }
}
