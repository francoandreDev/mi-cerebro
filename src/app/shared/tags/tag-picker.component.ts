import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';
import type { Tag } from '@core/tags/tag.types';
import { TAG_SWATCHES, tagHexFor } from '@core/theme/theme-palette';
import { ThemeService } from '@core/theme/theme.service';
import { BgColorDirective } from '@shared/directives/bg-color.directive';

import { TagChipComponent } from './tag-chip.component';

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

@Component({
  selector: 'mc-tag-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagChipComponent, BgColorDirective],
  template: `
    <div class="row">
      @for (tag of selectedTags(); track tag.id) {
        <mc-tag-chip
          [tag]="tag"
          [removable]="editable()"
          [dotClickable]="editable()"
          (remove)="removeTag.emit(tag.id)"
          (dotClick)="toggleRecolor(tag.id)"
        />
      }
      @if (editable()) {
        <input
          #input
          type="text"
          class="input"
          [value]="query()"
          [placeholder]="selectedIds().length === 0 ? t('tags.placeholder') : ''"
          [attr.aria-label]="t('tags.placeholder')"
          (input)="onInput($event)"
          (keydown)="onKey($event)"
          (focus)="open.set(true)"
          (blur)="onBlur()"
        />
      }
    </div>
    @if (editable() && recoloringId(); as rid) {
      <div class="palette" role="group" [attr.aria-label]="t('tags.color.label')">
        <button
          type="button"
          class="swatch default"
          [attr.aria-label]="t('tags.color.default')"
          (click)="pickSwatch(rid, null)"
        >
          ✕
        </button>
        @for (sw of swatches; track sw.id) {
          <button
            type="button"
            class="swatch"
            [mcBgColor]="swatchHex(sw.id)"
            [attr.aria-label]="sw.id"
            (click)="pickSwatch(rid, sw.id)"
          ></button>
        }
      </div>
    }
    @if (editable() && open() && suggestions().length + (canCreate() ? 1 : 0) > 0) {
      <ul class="menu" role="listbox">
        @for (s of suggestions(); track s.id; let i = $index) {
          <li
            class="item"
            role="option"
            [class.highlight]="cursor() === i"
            [attr.aria-selected]="cursor() === i"
            (mousedown)="pickExisting($event, s)"
          >
            <mc-tag-chip [tag]="s" [size]="'small'" />
          </li>
        }
        @if (canCreate()) {
          <li
            class="item create"
            role="option"
            [class.highlight]="cursor() === suggestions().length"
            [attr.aria-selected]="cursor() === suggestions().length"
            (mousedown)="pickCreate($event)"
          >
            {{ t('tags.createPrefix') }} "{{ query().trim() }}"
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './tag-picker.component.css',
})
export class TagPickerComponent {
  readonly availableTags = input.required<readonly Tag[]>();
  readonly selectedIds = input.required<readonly string[]>();
  readonly editable = input<boolean>(true);
  readonly addTag = output<string>(); // label (existing or new — service decides)
  readonly removeTag = output<string>(); // id

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly cursor = signal(0);
  protected readonly recoloringId = signal<string | null>(null);
  protected readonly swatches = TAG_SWATCHES;

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly tags = inject(TagsService);

  protected toggleRecolor(id: string): void {
    this.recoloringId.set(this.recoloringId() === id ? null : id);
  }

  protected pickSwatch(id: string, swatchId: string | null): void {
    void this.tags.setSwatch(id, swatchId);
    this.recoloringId.set(null);
  }

  protected swatchHex(id: string): string {
    return tagHexFor(this.theme.resolved(), id) ?? '#888';
  }

  protected readonly selectedTags = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.availableTags().filter((t) => ids.has(t.id));
  });

  protected readonly suggestions = computed<readonly Tag[]>(() => {
    const q = norm(this.query());
    const taken = new Set(this.selectedIds());
    const pool = this.availableTags().filter((t) => !taken.has(t.id));
    if (q === '') return pool.slice(0, 8);
    return pool.filter((t) => norm(t.label).includes(q)).slice(0, 8);
  });

  protected readonly canCreate = computed(() => {
    const q = norm(this.query());
    if (q === '') return false;
    return !this.availableTags().some((t) => norm(t.label) === q);
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.cursor.set(0);
    this.open.set(true);
  }

  protected onKey(event: KeyboardEvent): void {
    const handler = this.keyHandlers[event.key];
    if (handler) handler(event);
  }

  private readonly keyHandlers: Record<string, (event: KeyboardEvent) => void> = {
    ArrowDown: (e) => this.moveCursor(e, +1),
    ArrowUp: (e) => this.moveCursor(e, -1),
    Enter: (e) => {
      e.preventDefault();
      this.commitCursor();
    },
    Escape: (e) => {
      e.preventDefault();
      this.open.set(false);
      this.query.set('');
    },
    Backspace: () => {
      if (this.query() !== '') return;
      const ids = this.selectedIds();
      if (ids.length > 0) this.removeTag.emit(ids[ids.length - 1]!);
    },
  };

  private moveCursor(event: KeyboardEvent, delta: number): void {
    const total = this.suggestions().length + (this.canCreate() ? 1 : 0);
    if (total === 0) return;
    event.preventDefault();
    this.cursor.update((c) => (c + delta + total) % total);
  }

  protected pickExisting(event: Event, tag: Tag): void {
    event.preventDefault();
    this.addTag.emit(tag.label);
    this.reset();
  }

  protected pickCreate(event: Event): void {
    event.preventDefault();
    const label = this.query().trim();
    if (label === '') return;
    this.addTag.emit(label);
    this.reset();
  }

  protected onBlur(): void {
    // why: small delay so mousedown on a menu item fires before the menu closes.
    setTimeout(() => this.open.set(false), 120);
  }

  @HostListener('document:keydown.escape')
  protected onDocEscape(): void {
    if (this.open()) this.open.set(false);
  }

  private commitCursor(): void {
    const i = this.cursor();
    const list = this.suggestions();
    if (i < list.length) {
      const picked = list[i];
      if (picked) {
        this.addTag.emit(picked.label);
        this.reset();
      }
      return;
    }
    if (this.canCreate()) {
      const label = this.query().trim();
      if (label !== '') {
        this.addTag.emit(label);
        this.reset();
      }
    }
  }

  private reset(): void {
    this.query.set('');
    this.cursor.set(0);
    this.inputEl()?.nativeElement.focus();
  }
}
