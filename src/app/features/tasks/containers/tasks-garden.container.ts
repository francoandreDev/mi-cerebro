import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, openFolderActionDialog } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { between } from '@core/ordering/fractional-position';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { createDndController } from '@shared/utils/dnd-controller';
import { RowNavController } from '@shared/utils/row-nav.controller';

import { HarvestBasketComponent } from '../components/harvest-basket.component';
import { PlantCardComponent } from '../components/plant-card.component';
import { PLANT_GLYPHS, type PlantStage } from '../components/plant-glyphs';
import { PlanterComponent } from '../components/planter.component';
import type { TaskSummary } from '../models/task.types';
import { type Bucket, bucketTasks } from '../services/task-buckets';
import { TasksService } from '../services/tasks.service';
import { registerTasksPatioTutorial } from './tasks-patio.tutorial';
import { registerTasksTutorial } from './tasks.tutorial';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STAGE_BY_BUCKET: Record<Bucket, PlantStage> = {
  today: 'bloom',
  week: 'sprout',
  backlog: 'seed',
};
const WILT_THRESHOLD_DAYS = 3;
const NIGHT_KEY = 'mc.tasks.garden.night';
const WATERING_KEY = 'mc.tasks.garden.watering';
const VIEW_KEY = 'mc.tasks.garden.viewMode';
const BACKLOG_PAGE_SIZE = 24;

type ViewMode = 'garden' | 'list';

@Component({
  selector: 'mc-tasks-garden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    PlanterComponent,
    PlantCardComponent,
    HarvestBasketComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
    IconComponent,
  ],
  templateUrl: './tasks-garden.container.html',
  styleUrl: './tasks-garden.container.css',
})
export class TasksGardenContainer {
  private readonly tasksService = inject(TasksService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rowNav = new RowNavController(
    {
      rowIds: () => this.rowIds(),
      onToggle: (id) => void this.onHarvest(id),
      onOpen: (id) => {
        const s = this.summaries().find((x) => x.id === id);
        this.onOpen(id, s?.title ?? '');
      },
      onDelete: (id) => this.onDelete(id),
    },
    {
      next: 'tasks.shortcuts.next',
      prev: 'tasks.shortcuts.prev',
      open: 'tasks.shortcuts.open',
      toggle: 'tasks.shortcuts.harvest',
      del: 'tasks.shortcuts.delete',
    },
    'tasks',
  );
  protected readonly cursor = this.rowNav.cursor;

  constructor() {
    registerTasksTutorial();
    registerTasksPatioTutorial();
    const unregister = this.rowNav.register();
    this.destroyRef.onDestroy(unregister);
    effect(() => {
      const id = this.cursor.focusedId();
      if (!id) return;
      queueMicrotask(() => {
        document
          .querySelector(`[data-task-row="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  protected readonly STAGE_BY_BUCKET = STAGE_BY_BUCKET;
  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.tasksService.summaries;
  protected readonly query = signal<string>('');
  protected readonly creating = signal<boolean>(false);
  protected readonly night = signal<boolean>(readBool(NIGHT_KEY));
  protected readonly watering = signal<boolean>(readBool(WATERING_KEY));
  protected readonly viewMode = signal<ViewMode>(readView());
  protected readonly dnd = createDndController<Bucket>();
  protected readonly announce = signal<string>('');
  protected readonly wateredId = signal<string | null>(null);
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();
  protected readonly justSproutedId = signal<string | null>(null);
  protected readonly visibleBacklogCount = signal<number>(BACKLOG_PAGE_SIZE);
  protected readonly emergingFrom = signal<number>(BACKLOG_PAGE_SIZE);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.tasksService.folders;

  protected readonly untitledLabel = computed(() => this.t('tasks.untitledTitle'));

  private readonly inCurrentFolder = computed<readonly TaskSummary[]>(() =>
    this.summaries().filter((s) => s.folder === this.currentFolder()),
  );

  protected readonly filtered = computed<readonly TaskSummary[]>(() => {
    const q = norm(this.query().trim());
    if (!q) return this.inCurrentFolder();
    return this.inCurrentFolder().filter((s) => norm(s.title).includes(q));
  });

  protected readonly buckets = computed(() => bucketTasks(this.filtered(), new Date()));

  protected readonly pending = computed(() => ({
    today: this.buckets().today.filter((e) => !e.summary.done),
    week: this.buckets().week.filter((e) => !e.summary.done),
    backlog: this.buckets().backlog.filter((e) => !e.summary.done),
  }));

  protected readonly visibleBacklog = computed(() =>
    this.pending().backlog.slice(0, this.visibleBacklogCount()),
  );

  protected readonly hiddenBacklogCount = computed(() =>
    Math.max(0, this.pending().backlog.length - this.visibleBacklogCount()),
  );

  protected readonly loadMoreLabel = computed(() =>
    this.t('tasks.garden.loadMoreCount').replace('{n}', String(this.hiddenBacklogCount())),
  );

  // why: J/K cursor + list-mode order — each bucket array is already sorted
  //      by TaskSummary.position (TasksService.summariesSignal), the same
  //      order onWater() reorders — mirrors it instead of inventing a new one
  //      (see docs/deferred/reminders-goals.md).
  protected readonly rowIds = computed<readonly string[]>(() => [
    ...this.pending().today.map((e) => e.summary.id),
    ...this.pending().week.map((e) => e.summary.id),
    ...this.pending().backlog.map((e) => e.summary.id),
  ]);

  protected readonly listGroups = computed(() => [
    {
      key: 'today' as const,
      label: this.t('tasks.garden.planterToday'),
      emptyLabel: this.t('tasks.garden.empty.today'),
      items: this.pending().today,
    },
    {
      key: 'week' as const,
      label: this.t('tasks.garden.planterWeek'),
      emptyLabel: this.t('tasks.garden.empty.week'),
      items: this.pending().week,
    },
    {
      key: 'backlog' as const,
      label: this.t('tasks.garden.planterBacklog'),
      emptyLabel: this.t('tasks.garden.empty.backlog'),
      items: this.visibleBacklog(),
    },
  ]);

  protected readonly harvested = computed<readonly TaskSummary[]>(() => {
    return this.buckets()
      .today.filter((e) => e.summary.done)
      .map((e) => e.summary)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  protected readonly counts = computed(() =>
    this.t('tasks.garden.counts')
      .replace('{today}', String(this.pending().today.length))
      .replace('{week}', String(this.pending().week.length))
      .replace('{backlog}', String(this.pending().backlog.length)),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  // why: la leyenda siempre visible (§4.13 accesibilidad — nada de significado
  //      escondido detrás de hover/click) reusa los mismos glyphs SVG que
  //      `PlantCardComponent` para que el ícono de la leyenda sea idéntico
  //      al que el usuario ve en las cards, no una aproximación textual.
  protected stageGlyph(key: PlantStage | 'wilted'): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(PLANT_GLYPHS[key]);
  }

  protected wiltDaysFor(s: TaskSummary): number {
    if (!s.enteredHoyAt) return 0;
    const ms = Date.now() - new Date(s.enteredHoyAt).getTime();
    const days = Math.floor(ms / 86_400_000);
    return Math.max(0, days - WILT_THRESHOLD_DAYS);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
    this.visibleBacklogCount.set(BACKLOG_PAGE_SIZE);
    this.emergingFrom.set(BACKLOG_PAGE_SIZE);
  }

  protected onClearQuery(): void {
    this.query.set('');
    this.visibleBacklogCount.set(BACKLOG_PAGE_SIZE);
    this.emergingFrom.set(BACKLOG_PAGE_SIZE);
  }

  protected onLoadMoreBacklog(): void {
    const from = this.visibleBacklogCount();
    this.emergingFrom.set(from);
    this.visibleBacklogCount.set(from + BACKLOG_PAGE_SIZE);
    setTimeout(() => {
      if (this.emergingFrom() === from) this.emergingFrom.set(this.visibleBacklogCount());
    }, 500);
  }

  protected onToggleNight(): void {
    const next = !this.night();
    this.night.set(next);
    persistBool(NIGHT_KEY, next);
  }

  protected onToggleWatering(): void {
    const next = !this.watering();
    this.watering.set(next);
    persistBool(WATERING_KEY, next);
  }

  protected onToggleViewMode(): void {
    const next: ViewMode = this.viewMode() === 'garden' ? 'list' : 'garden';
    this.viewMode.set(next);
    persistView(next);
  }

  protected onOpen(id: string, title: string): void {
    void this.router.navigate(['/tasks', entitySlugSegment(title, id)]);
  }

  protected onOpenPatio(): void {
    void this.router.navigate(['/tasks', 'patio']);
  }

  protected readonly devMode = isDevMode();

  protected async onDevAgeOne(): Promise<void> {
    const candidate =
      this.pending().today[0] ?? this.pending().week[0] ?? this.pending().backlog[0];
    if (!candidate) return;
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.devAgeAndHarvest(candidate.summary.id, 20);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected onComposeSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem('title') as HTMLInputElement | null;
    if (!input) return;
    const value = input.value.trim();
    if (value === '') return;
    void this.create(value);
    input.value = '';
  }

  private async create(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const task = await this.tasksService.create(title, this.currentFolder());
      // why: por default, lo nuevo cae a SEMANA — no obstruye el cantero de HOY
      //      con cosas no priorizadas todavía.
      await this.tasksService.transplant(task.id, 'week');
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onDrop(bucket: Bucket): Promise<void> {
    const result = this.dnd.onDrop(bucket);
    if (!result) return;
    await this.applyTransplant(result.id, result.zone);
  }

  protected async onTransplant(event: { id: string; bucket: Bucket }): Promise<void> {
    await this.applyTransplant(event.id, event.bucket);
  }

  private async applyTransplant(id: string, bucket: Bucket): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.transplant(id, bucket);
      const summary = this.summaries().find((s) => s.id === id);
      const title = summary?.title || this.untitledLabel();
      const stage = this.t(`tasks.garden.planter${cap(bucket)}` as TranslationKey);
      this.announce.set(
        this.t('tasks.garden.aria.transplanted')
          .replace('{title}', title)
          .replace('{stage}', stage),
      );
      this.justSproutedId.set(id);
      setTimeout(() => {
        if (this.justSproutedId() === id) this.justSproutedId.set(null);
      }, 450);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onHarvest(id: string): Promise<void> {
    if (!prefersReducedMotion()) this.flyToBasket(id);
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.harvest(id);
      const summary = this.summaries().find((s) => s.id === id);
      const title = summary?.title || this.untitledLabel();
      this.announce.set(this.t('tasks.garden.aria.harvested').replace('{title}', title));
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  // why: la cesta de cosecha es un badge chico en el rincón del cantero HOY,
  //      no un lugar natural donde "aterrice" una card angular vía transición
  //      de layout normal (la card desaparece de un array y listo). Un clon
  //      DOM absoluto que vuela en arco hasta ahí y se auto-destruye da la
  //      sensación de cosecha sin inventar estado de animación por-tarea.
  private flyToBasket(id: string): void {
    const root = this.host.nativeElement;
    const cardEl = root.querySelector(`[data-task-id="${id}"]`) as HTMLElement | null;
    const basketEl = root.querySelector('.basket-stack .basket') as HTMLElement | null;
    if (!cardEl || !basketEl) return;
    const cardRect = cardEl.getBoundingClientRect();
    const basketRect = basketEl.getBoundingClientRect();
    const clone = cardEl.cloneNode(true) as HTMLElement;
    clone.classList.add('plant-flying');
    clone.style.left = `${cardRect.left}px`;
    clone.style.top = `${cardRect.top}px`;
    clone.style.width = `${cardRect.width}px`;
    const dx = basketRect.left + basketRect.width / 2 - (cardRect.left + cardRect.width / 2);
    const dy = basketRect.top + basketRect.height / 2 - (cardRect.top + cardRect.height / 2);
    clone.style.setProperty('--fly-dx', `${dx}px`);
    clone.style.setProperty('--fly-dy', `${dy}px`);
    document.body.appendChild(clone);
    clone.addEventListener('animationend', () => clone.remove(), { once: true });
    setTimeout(() => clone.remove(), 700);
  }

  protected async onWater(id: string, bucket: 'week' | 'backlog'): Promise<void> {
    const list = this.pending()[bucket];
    const idx = list.findIndex((e) => e.summary.id === id);
    if (idx <= 0) return;
    const above = list[idx - 1]!.summary.position;
    const aboveAbove = idx >= 2 ? list[idx - 2]!.summary.position : null;
    const newPosition = between(aboveAbove, above);
    try {
      await this.workspace.ensureWritable();
      await this.tasksService.setPosition(id, newPosition);
      const summary = this.summaries().find((s) => s.id === id);
      const title = summary?.title || this.untitledLabel();
      this.announce.set(this.t('tasks.garden.aria.watered').replace('{title}', title));
      this.wateredId.set(id);
      setTimeout(() => {
        if (this.wateredId() === id) this.wateredId.set(null);
      }, 480);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected onDelete(id: string): void {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    this.confirm.ask(
      {
        title: this.t('tasks.confirm.delete.title'),
        message: this.t('tasks.deleteConfirm').replace('{title}', label),
        confirmLabel: this.t('tasks.confirm.delete.confirm'),
        cancelLabel: this.t('tasks.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.tasksService.deleteToTrash(id);
          await this.autosave.clear(id);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected onCreateSubfolder(): void {
    handleCreateFolder(
      'task',
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
      this.currentFolder(),
    );
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `task:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const readBool = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const persistBool = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore quota */
  }
};
const readView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'garden';
  } catch {
    return 'garden';
  }
};
const persistView = (v: ViewMode): void => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore quota */
  }
};
