import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { Bucket, BucketedTask } from '../services/task-buckets';
import { TaskCardComponent } from './task-card.component';

@Component({
  selector: 'mc-task-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TaskCardComponent],
  template: `
    <section class="column" [attr.aria-label]="ariaLabel()">
      <header class="head">
        <h2 class="title">
          <mc-icon [name]="icon()" class="title-icon" aria-hidden="true" />
          {{ title() }}
          <span class="count">{{ visible().length }}</span>
        </h2>
      </header>
      <div class="cards">
        @for (entry of visible(); track entry.summary.id) {
          <mc-task-card
            [entry]="entry"
            [availableTags]="availableTags()"
            [untitledLabel]="untitledLabel()"
            (open)="open.emit($event)"
            (toggleDone)="toggleDone.emit($event)"
            (remove)="remove.emit($event)"
            (move)="moveTask.emit($event)"
          />
        }
        @if (visible().length === 0) {
          <p class="empty">{{ t('tasks.board.columnEmpty') }}</p>
        }
      </div>
      <form class="new" (submit)="onSubmit($event)">
        <mc-icon name="plus" class="new-icon" aria-hidden="true" />
        <input
          #input
          type="text"
          class="new-input"
          [attr.aria-label]="ariaNew()"
          [placeholder]="t('tasks.board.newPlaceholder')"
          [disabled]="busy()"
          autocomplete="off"
        />
      </form>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-3);
      height: 100%;
      min-height: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .title {
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
      margin: 0;
      font-size: var(--mc-font-size-lg);
      color: var(--mc-fg-primary);
    }
    .title-icon {
      color: var(--mc-accent-primary);
    }
    .count {
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-muted);
      background: var(--mc-bg-elevated);
      border-radius: var(--mc-radius-pill, 999px);
      padding: 0 8px;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding-right: 2px;
    }
    .empty {
      margin: 0;
      color: var(--mc-fg-muted);
      font-style: italic;
      font-size: var(--mc-font-size-sm);
      padding: var(--mc-space-3) 0;
      text-align: center;
    }
    .new {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-2);
      background: var(--mc-bg-elevated);
      border: 1px dashed var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
    }
    .new:focus-within {
      border-color: var(--mc-accent-primary);
      border-style: solid;
    }
    .new-icon {
      color: var(--mc-fg-muted);
    }
    .new-input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-sm);
    }
    .new-input:focus {
      outline: none;
    }
  `,
})
export class TaskColumnComponent {
  readonly bucket = input.required<Bucket>();
  readonly entries = input.required<readonly BucketedTask[]>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly hideDone = input<boolean>(false);
  readonly busy = input<boolean>(false);

  readonly open = output<string>();
  readonly toggleDone = output<string>();
  readonly remove = output<string>();
  readonly moveTask = output<{ id: string; bucket: Bucket }>();
  readonly createInline = output<{ bucket: Bucket; title: string }>();

  private readonly i18n = inject(I18nService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly title = computed(() =>
    this.t(`tasks.board.bucket.${this.bucket()}.title` as TranslationKey),
  );
  protected readonly icon = computed(() => BUCKET_ICONS[this.bucket()]);
  protected readonly ariaLabel = computed(() => this.title());
  protected readonly ariaNew = computed(() =>
    this.t('tasks.board.newAria').replace('{bucket}', this.title()),
  );

  protected readonly visible = computed(() => {
    const list = this.entries();
    if (!this.hideDone()) return list;
    return list.filter((e) => !e.summary.done);
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const el = this.inputRef().nativeElement;
    const value = el.value.trim();
    if (value === '') return;
    this.createInline.emit({ bucket: this.bucket(), title: value });
    el.value = '';
  }
}

const BUCKET_ICONS: Record<Bucket, 'sun-horizon' | 'calendar-blank' | 'hourglass-medium'> = {
  today: 'sun-horizon',
  week: 'calendar-blank',
  backlog: 'hourglass-medium',
};
