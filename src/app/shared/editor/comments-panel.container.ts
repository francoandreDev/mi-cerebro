// 13f — Comments index popover. Lists active + orphaned comments for the
// current entity; clicking a row asks the host editor to open the comment
// popover anchored to the corresponding cloud. Creation moved to the
// bubble menu + comment popover; no in-panel form here anymore.

import type { JSONContent } from '@tiptap/core';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';
import { CommentsService } from '@core/versioning/comments.service';
import { applyOrphanFlags } from '@core/versioning/comments-orphans';
import type { Comment } from '@core/versioning/comments.types';
import { IconComponent } from '@shared/icon/icon.component';

import { CommentItemComponent } from './comment-item.component';

@Component({
  selector: 'mc-comments-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentItemComponent, IconComponent],
  template: `
    <header class="head">
      <h3 id="mc-comments-title">{{ t('comments.title') }} ({{ count() }})</h3>
      <button
        type="button"
        class="icon"
        (click)="closed.emit()"
        [attr.aria-label]="t('comments.close')"
      >
        <mc-icon name="x" />
      </button>
    </header>

    @if (loading()) {
      <p class="muted">{{ t('comments.loading') }}</p>
    } @else {
      @if (active().length === 0 && orphaned().length === 0) {
        <div class="empty">
          <strong>{{ t('comments.empty.title') }}</strong>
          <p class="muted">{{ t('comments.empty.hint') }}</p>
        </div>
      }

      <ul class="list" aria-live="polite" aria-labelledby="mc-comments-title">
        @for (c of active(); track c.id) {
          <li
            class="row clickable"
            role="button"
            tabindex="0"
            (click)="openComment.emit(c.id)"
            (keydown.enter)="openComment.emit(c.id)"
            (keydown.space)="openComment.emit(c.id); $event.preventDefault()"
          >
            <mc-comment-item [comment]="c" (delete)="onDelete($event)" />
          </li>
        }
      </ul>

      @if (orphaned().length > 0) {
        <section class="orphans" aria-labelledby="mc-comments-orph-h">
          <h4 id="mc-comments-orph-h">{{ t('comments.orphaned.title') }}</h4>
          <p class="muted small">{{ t('comments.orphaned.hint') }}</p>
          <ul class="list">
            @for (c of orphaned(); track c.id) {
              <li class="row orphan">
                <mc-comment-item [comment]="c" (delete)="onDelete($event)" />
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styleUrl: './comments-panel.container.scss',
})
export class CommentsPanelContainer {
  readonly entityId = input.required<string>();
  readonly entityTitle = input<string>('');
  readonly value = input<JSONContent | null>(null);
  readonly closed = output<void>();
  readonly openComment = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly comments = inject(CommentsService);
  private readonly errors = inject(ErrorService);
  private readonly injector = inject(Injector);

  private readonly all = signal<readonly Comment[]>([]);
  protected readonly loading = signal(false);

  protected readonly active = computed(() => this.all().filter((c) => !c.orphaned));
  protected readonly orphaned = computed(() => this.all().filter((c) => c.orphaned));
  protected readonly count = computed(() => this.all().length);
  private readonly blockIds = computed(() => collectBlockIds(this.value()));

  constructor() {
    effect(
      () => {
        const id = this.entityId();
        if (!id) {
          this.all.set([]);
          return;
        }
        void this.loadFor(id);
      },
      { injector: this.injector },
    );
    effect(
      () => {
        const ids = this.blockIds();
        this.all.update((list) => applyOrphanFlags(list, ids));
      },
      { injector: this.injector },
    );
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onDelete(id: string): Promise<void> {
    if (typeof confirm !== 'function') return;
    if (!confirm(this.t('comments.confirm.delete'))) return;
    const next = this.all().filter((c) => c.id !== id);
    try {
      await this.comments.save(this.entityId(), this.entityTitle(), next);
      this.all.set(next);
    } catch (err) {
      this.errors.report(err);
    }
  }

  private async loadFor(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const file = await this.comments.read(id);
      if (this.entityId() === id) {
        this.all.set(applyOrphanFlags(file.comments, this.blockIds()));
      }
    } catch (err) {
      this.errors.report(err);
      if (this.entityId() === id) this.all.set([]);
    } finally {
      if (this.entityId() === id) this.loading.set(false);
    }
  }
}

const collectBlockIds = (doc: JSONContent | null): Set<string> => {
  const ids = new Set<string>();
  if (!doc) return ids;
  const walk = (node: JSONContent): void => {
    const id = node.attrs?.[BLOCK_ID_ATTR];
    if (typeof id === 'string' && id.length > 0) ids.add(id);
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return ids;
};
