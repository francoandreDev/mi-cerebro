import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';

import { HarvestedPlantComponent } from '../components/harvested-plant.component';
import type { HarvestedShape } from '../components/plant-glyphs';
import type { TaskSummary } from '../models/task.types';
import { TasksService } from '../services/tasks.service';

// why: días vividos antes de cosechar para que la planta se promueva a árbol.
//      Suficientemente común para que aparezca; suficientemente alto para
//      que se sienta ganado. Si pica, sube a configuración.
const TREE_LONGEVITY_DAYS = 14;

interface HarvestedItem {
  readonly summary: TaskSummary;
  readonly shape: HarvestedShape;
  readonly longevityDays: number;
}

interface MonthGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly HarvestedItem[];
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

@Component({
  selector: 'mc-tasks-patio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HarvestedPlantComponent],
  templateUrl: './tasks-patio.container.html',
  styleUrl: './tasks-patio.container.css',
})
export class TasksPatioContainer {
  private readonly tasksService = inject(TasksService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly untitledLabel = computed(() => this.t('tasks.untitledTitle'));

  protected readonly groups = computed<readonly MonthGroup[]>(() => {
    const done = this.tasksService.summaries().filter((s) => s.done);
    const byMonth = new Map<string, HarvestedItem[]>();
    for (const summary of done) {
      const updated = new Date(summary.updatedAt);
      const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, '0')}`;
      const days = longevityDays(summary);
      const shape: HarvestedShape = days >= TREE_LONGEVITY_DAYS ? 'tree' : 'bloom';
      const item: HarvestedItem = { summary, shape, longevityDays: days };
      const list = byMonth.get(key);
      if (list) list.push(item);
      else byMonth.set(key, [item]);
    }
    const groups: MonthGroup[] = [];
    for (const [key, items] of byMonth) {
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const monthIdx = Number(monthStr) - 1;
      const monthName = MONTHS_ES[monthIdx] ?? monthStr ?? '';
      groups.push({
        key,
        label: this.t('tasks.patio.month.format')
          .replace('{month}', monthName)
          .replace('{year}', String(year)),
        items: items.slice().sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt)),
      });
    }
    return groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  });

  protected readonly empty = computed(() => this.groups().length === 0);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onBack(): void {
    void this.router.navigate(['/tasks']);
  }

  protected onOpen(id: string): void {
    void this.router.navigate(['/tasks', id]);
  }
}

const longevityDays = (summary: TaskSummary): number => {
  // why: TaskSummary no expone createdAt; usamos enteredHoyAt como mejor proxy
  //      del momento de entrada a HOY (cuando se "empezó a cosechar"). Si nunca
  //      pasó por HOY (cosechada directo desde semana/backlog), 0 días.
  const start = summary.enteredHoyAt;
  if (!start) return 0;
  const ms = new Date(summary.updatedAt).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};
