import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { SearchIndexService } from '@core/search/search-index.service';
import { LINKABLE_ENTITY_KINDS, type SearchHit } from '@core/search/search.types';
import { entityKindIcon } from '@shared/entity-cards/entity-kind-icon';
import { AutofocusDirective } from '@shared/forms/autofocus.directive';
import { IconComponent } from '@shared/icon/icon.component';

export interface EntityLinkPicked {
  readonly kind: string;
  readonly id: string;
  readonly label: string;
}

const RESULT_LIMIT = 8;

// why: mismo molde que ImagePickerDialogComponent (backdrop + dialog
//      standalone), pero busca sobre el índice ya existente de §10
//      (SearchIndexService) en vez de listar galerías — no hay índice
//      nuevo que construir para "Vincular a…" (§10bis).
@Component({
  selector: 'mc-entity-link-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AutofocusDirective],
  template: `
    <div class="backdrop" (click)="dismiss.emit()" role="presentation"></div>
    <div class="dialog" role="dialog" aria-modal="true">
      <header>
        <mc-icon name="magnifying-glass" />
        <input
          #searchInput
          mcAutofocus
          type="text"
          [placeholder]="t('editor.linkPicker.placeholder')"
          [attr.aria-label]="t('editor.linkPicker.placeholder')"
          (input)="onQueryInput($event)"
        />
        <button type="button" class="ghost" (click)="dismiss.emit()" aria-label="Cerrar">
          <mc-icon name="x" />
        </button>
      </header>
      @if (results().length === 0) {
        <p class="empty">{{ t('editor.linkPicker.empty') }}</p>
      } @else {
        <ul class="results">
          @for (hit of results(); track hit.id) {
            <li>
              <button type="button" (click)="pick(hit)">
                <span class="kind-icon">
                  <mc-icon [name]="iconFor(hit.kind)" />
                </span>
                <span class="txt">
                  <span class="label">{{ hit.title }}</span>
                  @if (hit.snippet.match) {
                    <span class="preview"
                      >{{ hit.snippet.pre }}<mark>{{ hit.snippet.match }}</mark
                      >{{ hit.snippet.post }}</span
                    >
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .dialog {
      position: relative;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      width: min(420px, 92vw);
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: var(--mc-shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.4));
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-2) var(--mc-space-3);
      border-bottom: 1px solid var(--mc-border-default);
      color: var(--mc-fg-muted);
    }
    header input {
      flex: 1;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-md);
    }
    header input:focus {
      outline: none;
    }
    .ghost {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-muted);
    }
    .empty {
      padding: var(--mc-space-4);
      color: var(--mc-fg-muted);
      text-align: center;
    }
    .results {
      list-style: none;
      margin: 0;
      padding: var(--mc-space-1);
      overflow-y: auto;
    }
    .results button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      text-align: left;
      background: transparent;
      border: 0;
      border-radius: var(--mc-radius-sm);
      padding: var(--mc-space-2);
      cursor: pointer;
      color: var(--mc-fg-primary);
    }
    .results button:hover,
    .results button:focus-visible {
      background: var(--mc-bg-selected);
      outline: none;
    }
    .kind-icon {
      display: inline-flex;
      width: 26px;
      height: 26px;
      border-radius: var(--mc-radius-sm);
      background: var(--mc-bg-hover);
      color: var(--mc-accent-primary);
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .txt {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .label {
      font-size: var(--mc-font-size-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview mark {
      background: transparent;
      color: var(--mc-accent-primary);
      font-weight: 600;
    }
  `,
})
export class EntityLinkPickerDialogComponent {
  readonly excludeId = input<string>('');
  readonly picked = output<EntityLinkPicked>();
  readonly dismiss = output<void>();

  private readonly searchIndex = inject(SearchIndexService);
  private readonly i18n = inject(I18nService);

  private readonly queryText = signal('');
  protected readonly results = computed<readonly SearchHit[]>(() =>
    this.searchIndex
      .query({ text: this.queryText(), kinds: LINKABLE_ENTITY_KINDS, limit: RESULT_LIMIT + 1 })
      .filter((hit) => hit.id !== this.excludeId())
      .slice(0, RESULT_LIMIT),
  );

  constructor() {
    void this.searchIndex.load();
  }

  protected t(key: Parameters<I18nService['t']>[0]): string {
    return this.i18n.t(key);
  }

  protected iconFor(kind: string): ReturnType<typeof entityKindIcon> {
    return entityKindIcon(kind);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.queryText.set(target?.value ?? '');
  }

  protected pick(hit: SearchHit): void {
    this.picked.emit({ kind: hit.kind, id: hit.id, label: hit.title });
  }
}
