// 13c-iii — Comments side panel mounted by EditorComponent. Owns the
// comments state for the active entity: reads on entity change, persists
// on add/delete via CommentsService. Item rows and the create form are
// dumb sub-components; this container holds the data and the
// orchestration.

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
import { CommentsService } from '@core/versioning/comments.service';
import { applyOrphanFlags } from '@core/versioning/comments-orphans';
import type { Comment, CommentAnchorType } from '@core/versioning/comments.types';
import { IconComponent } from '@shared/icon/icon.component';

import { extractBlockSummaries, type BlockSummary } from './block-summaries';
import { CommentFormComponent } from './comment-form.component';
import { CommentItemComponent } from './comment-item.component';

@Component({
  selector: 'mc-comments-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentFormComponent, CommentItemComponent, IconComponent],
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
      @if (active().length === 0 && !formOpen()) {
        <div class="empty">
          <strong>{{ t('comments.empty.title') }}</strong>
          <p class="muted">{{ t('comments.empty.hint') }}</p>
        </div>
      }

      <ul class="list" aria-live="polite" aria-labelledby="mc-comments-title">
        @for (c of active(); track c.id) {
          <li class="row">
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

      @if (formOpen()) {
        <mc-comment-form
          [blocks]="blocks()"
          [anchorType]="formAnchorType()"
          [anchor]="formAnchor()"
          [body]="formBody()"
          [error]="formError()"
          [saving]="saving()"
          (anchorTypeChange)="setAnchorType($event)"
          (anchorChange)="setAnchor($event)"
          (bodyChange)="setBody($event)"
          (submitForm)="onSubmit()"
          (cancelForm)="closeForm()"
        />
      } @else {
        <button type="button" class="primary new" (click)="openForm()">
          + {{ t('comments.new') }}
        </button>
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

  private readonly i18n = inject(I18nService);
  private readonly comments = inject(CommentsService);
  private readonly errors = inject(ErrorService);
  private readonly injector = inject(Injector);

  private readonly all = signal<readonly Comment[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formAnchorType = signal<CommentAnchorType>('entity');
  protected readonly formAnchor = signal<string>('');
  protected readonly formBody = signal<string>('');
  protected readonly formError = signal<string>('');

  protected readonly active = computed(() => this.all().filter((c) => !c.orphaned));
  protected readonly orphaned = computed(() => this.all().filter((c) => c.orphaned));
  protected readonly count = computed(() => this.all().length);
  protected readonly blocks = computed<readonly BlockSummary[]>(() =>
    extractBlockSummaries(this.value() ?? undefined),
  );

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
    // why: position tracking — every time the doc changes the set of
    //      visible block ids may change, so block-anchored comments need
    //      their orphan flag re-derived. The helper is a no-op when
    //      nothing changed, so this effect doesn't ping-pong.
    effect(
      () => {
        const ids = new Set(this.blocks().map((b) => b.blockId));
        this.all.update((list) => applyOrphanFlags(list, ids));
      },
      { injector: this.injector },
    );
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected setAnchorType(t: CommentAnchorType): void {
    this.formAnchorType.set(t);
    if (t === 'entity') this.formAnchor.set('');
    this.formError.set('');
  }

  protected setAnchor(v: string): void {
    this.formAnchor.set(v);
    this.formError.set('');
  }

  protected setBody(v: string): void {
    this.formBody.set(v);
    this.formError.set('');
  }

  protected openForm(): void {
    this.formOpen.set(true);
    this.formAnchorType.set('entity');
    this.formAnchor.set('');
    this.formBody.set('');
    this.formError.set('');
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected async onSubmit(): Promise<void> {
    const body = this.formBody().trim();
    if (body.length === 0) {
      this.formError.set(this.t('comments.errors.empty'));
      return;
    }
    if (this.formAnchorType() === 'block' && this.formAnchor() === '') {
      this.formError.set(this.t('comments.errors.noBlock'));
      return;
    }
    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      anchorType: this.formAnchorType(),
      anchor: this.formAnchorType() === 'entity' ? this.entityId() : this.formAnchor(),
      body: textToDoc(body),
      createdAt: now,
      updatedAt: now,
      orphaned: false,
    };
    await this.persist([...this.all(), comment], () => this.closeForm());
  }

  protected async onDelete(id: string): Promise<void> {
    if (typeof confirm !== 'function') return;
    if (!confirm(this.t('comments.confirm.delete'))) return;
    await this.persist(this.all().filter((c) => c.id !== id));
  }

  private async loadFor(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const file = await this.comments.read(id);
      if (this.entityId() === id) {
        // why: persisted orphan flags can be stale (the branch was last
        //      written before the user's most recent main edits). Apply
        //      the current doc's block-id set before exposing the list.
        const ids = new Set(this.blocks().map((b) => b.blockId));
        this.all.set(applyOrphanFlags(file.comments, ids));
      }
    } catch (err) {
      this.errors.report(err);
      if (this.entityId() === id) this.all.set([]);
    } finally {
      if (this.entityId() === id) this.loading.set(false);
    }
  }

  private async persist(
    next: readonly Comment[],
    onSuccess: () => void = () => undefined,
  ): Promise<void> {
    const id = this.entityId();
    if (!id) return;
    this.saving.set(true);
    try {
      await this.comments.save(id, this.entityTitle(), next);
      this.all.set(next);
      onSuccess();
    } catch (err) {
      this.errors.report(err);
      this.formError.set(this.t('comments.errors.saveFailed'));
    } finally {
      this.saving.set(false);
    }
  }
}

function textToDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}
