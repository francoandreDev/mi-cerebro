// Create-variant modal. Owns its draft state (name / color / from)
// and the live validation; the container only toggles visibility and
// reacts to `submit` / `cancel`.

import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PRINCIPAL_VARIANT_ID, variantSlug, type Variant } from '@core/versioning/variants.types';

import type { VariantOverview } from '../services/variants-stats.service';

export interface CreateVariantRequest {
  readonly name: string;
  readonly color: string;
  readonly fromVariantId: string;
}

// Palette tuned for legibility on both light (sand) and dark (slate)
// themes. Each entry is HEX so it survives the color picker round-trip.
const PALETTE: readonly string[] = [
  '#ff7a45',
  '#f5b400',
  '#3fb950',
  '#58a6ff',
  '#a370f7',
  '#f06292',
  '#26c6da',
  '#9aa4af',
];

@Component({
  selector: 'mc-variants-create-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  // why: modal renders position:fixed; the host should not occupy any
  //      box in the parent layout (otherwise it intercepts pointer
  //      events on siblings as a flex/grid child).
  host: { style: 'display: contents' },
  template: `
    @if (visible()) {
      <button
        type="button"
        class="modal-backdrop"
        [attr.aria-label]="t('variants.form.cancel')"
        (click)="cancelled.emit()"
      ></button>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (keydown.escape)="cancelled.emit()"
        (keydown.control.enter)="trySubmit()"
        (keydown.meta.enter)="trySubmit()"
      >
        <h3 [id]="titleId">{{ t('variants.form.title') }}</h3>

        <label class="field">
          <span>{{ t('variants.form.name') }}</span>
          <input
            #nameInput
            type="text"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            [placeholder]="t('variants.form.name.placeholder')"
            [attr.aria-invalid]="!!errorKey()"
            [attr.aria-describedby]="errorKey() ? errorId : hintId"
          />
          @if (errorKey(); as ek) {
            <span class="field-error" [id]="errorId">{{ t(ek) }}</span>
          } @else if (slug()) {
            <span class="field-hint" [id]="hintId">
              {{ t('variants.form.slug.preview') }}
              <code>variant/{{ slug() }}/main</code>
            </span>
          }
        </label>

        <div class="field">
          <span>{{ t('variants.form.color') }}</span>
          <div class="palette" role="radiogroup" [attr.aria-label]="t('variants.form.color')">
            @for (c of palette; track c) {
              <button
                type="button"
                class="swatch-btn"
                role="radio"
                [class.is-selected]="color() === c"
                [attr.aria-checked]="color() === c"
                [attr.aria-label]="c"
                [style.background-color]="c"
                (click)="color.set(c)"
              ></button>
            }
            <input
              type="color"
              [ngModel]="color()"
              (ngModelChange)="color.set($event)"
              [attr.aria-label]="t('variants.form.color.custom')"
            />
          </div>
        </div>

        <label class="field">
          <span>{{ t('variants.form.from') }}</span>
          <select [ngModel]="fromId()" (ngModelChange)="fromId.set($event)">
            @for (p of parents(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
          @if (parentSummary(); as s) {
            <span class="field-hint">
              {{ s.label }}
              @if (s.sha) {
                · <code>{{ s.sha }}</code>
              }
            </span>
          }
        </label>

        <div class="modal-actions">
          <button type="button" class="ghost" (click)="cancelled.emit()" [disabled]="busy()">
            {{ t('variants.form.cancel') }}
          </button>
          <button
            type="button"
            class="primary"
            (click)="trySubmit()"
            [disabled]="busy() || !!errorKey()"
          >
            {{ t('variants.form.create') }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: '../containers/variants.container.css',
})
export class VariantsCreateModalComponent {
  private readonly i18n = inject(I18nService);

  readonly visible = input.required<boolean>();
  readonly parents = input.required<readonly Variant[]>();
  readonly overviews = input.required<Record<string, VariantOverview>>();
  readonly initialFromId = input<string>(PRINCIPAL_VARIANT_ID);
  readonly busy = input<boolean>(false);

  readonly submitted = output<CreateVariantRequest>();
  readonly cancelled = output<void>();

  protected readonly palette = PALETTE;
  protected readonly titleId = 'mc-variants-create-title';
  protected readonly errorId = 'mc-variants-create-name-error';
  protected readonly hintId = 'mc-variants-create-name-hint';

  protected readonly name = signal('');
  protected readonly color = signal<string>(PALETTE[0]!);
  protected readonly fromId = signal<string>(PRINCIPAL_VARIANT_ID);

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly slug = computed(() => variantSlug(this.name().trim()));

  protected readonly errorKey = computed<TranslationKey | null>(() => {
    const trimmed = this.name().trim();
    if (!trimmed) return null;
    const s = this.slug();
    if (!s || s === PRINCIPAL_VARIANT_ID) return 'variants.form.error.invalid';
    if (this.parents().some((p) => p.id === s)) return 'variants.form.error.duplicate';
    return null;
  });

  protected readonly parentSummary = computed<{ label: string; sha: string | null } | null>(() => {
    const id = this.fromId();
    const parent = this.parents().find((p) => p.id === id);
    if (!parent) return null;
    const ov = this.overviews()[id] ?? null;
    if (!ov?.head) {
      return { label: this.t('variants.form.from.empty'), sha: null };
    }
    return { label: ov.head.subject, sha: ov.head.oid.slice(0, 7) };
  });

  constructor() {
    // why: every time the modal opens, reset the draft state to the
    //      seed values. Without this, reopening keeps stale text from
    //      a previous attempt.
    effect(() => {
      if (!this.visible()) return;
      this.name.set('');
      this.color.set(PALETTE[0]!);
      this.fromId.set(this.initialFromId());
      queueMicrotask(() => this.nameInput()?.nativeElement.focus());
    });
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected trySubmit(): void {
    const trimmed = this.name().trim();
    if (!trimmed || this.errorKey()) return;
    this.submitted.emit({
      name: trimmed,
      color: this.color(),
      fromVariantId: this.fromId(),
    });
  }
}
