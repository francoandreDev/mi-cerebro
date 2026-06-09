import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { I18nService } from '@core/i18n/i18n.service';
import { ImageReaderService } from '@core/images/image-reader.service';
import { IMAGE_REF_NAME, createImageRefNode } from '@core/tiptap/image-ref/image-ref.node';

import { ImagePickerDialogComponent } from './image-picker-dialog.component';

@Component({
  selector: 'mc-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImagePickerDialogComponent],
  template: `
    @if (editable() && hasGalleries()) {
      <div class="toolbar">
        <button
          type="button"
          class="ghost"
          (click)="openPicker()"
          [attr.aria-label]="t('editor.insertImage')"
        >
          🖼 {{ t('editor.insertImage') }}
        </button>
      </div>
    }
    <div #host class="editor-host" data-testid="editor-host"></div>
    @if (pickerOpen()) {
      <mc-image-picker-dialog (picked)="onPicked($event)" (dismiss)="closePicker()" />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      gap: var(--mc-space-1);
      padding: 0 0 var(--mc-space-1) 0;
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      padding: var(--mc-space-1) var(--mc-space-2);
      border-radius: var(--mc-radius-sm);
    }
    .ghost:hover {
      color: var(--mc-fg-primary);
      background: var(--mc-bg-elevated);
    }
    .editor-host :global(.mc-image-ref) {
      display: inline-block;
      vertical-align: middle;
    }
    .editor-host :global(.mc-image-ref img) {
      max-width: 320px;
      max-height: 240px;
      border-radius: var(--mc-radius-sm);
    }
    .editor-host :global(.mc-image-ref--missing) {
      display: inline-block;
      padding: 2px 6px;
      border: 1px dashed var(--mc-border-default);
      color: var(--mc-fg-muted);
    }
    .editor-host {
      min-height: 200px;
      padding: var(--mc-space-3);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      background: var(--mc-bg-elevated);
      color: var(--mc-fg-primary);
    }
    .editor-host:focus-within {
      border-color: var(--mc-accent-primary);
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: -2px;
    }
    .editor-host :global(.ProseMirror) {
      outline: none;
      min-height: 180px;
    }
    .editor-host :global(.ProseMirror p.is-editor-empty:first-child::before) {
      content: attr(data-placeholder);
      color: var(--mc-fg-muted);
      pointer-events: none;
      float: left;
      height: 0;
    }
  `,
})
export class EditorComponent {
  readonly value = input.required<JSONContent>();
  readonly placeholder = input<string>('');
  readonly editable = input<boolean>(true);
  readonly valueChange = output<JSONContent>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reader = inject(ImageReaderService);
  private readonly i18n = inject(I18nService);

  protected readonly pickerOpen = signal(false);
  protected readonly hasGalleries = (): boolean => this.reader.summaries().length > 0;

  protected t(key: Parameters<I18nService['t']>[0]): string {
    return this.i18n.t(key);
  }

  protected openPicker(): void {
    this.pickerOpen.set(true);
  }

  protected closePicker(): void {
    this.pickerOpen.set(false);
  }

  protected onPicked(payload: { galleryId: string; imageId: string; alt: string }): void {
    this.pickerOpen.set(false);
    const ed = this.editor;
    if (!ed) return;
    ed.chain()
      .focus()
      .insertContent({
        type: IMAGE_REF_NAME,
        attrs: { galleryId: payload.galleryId, imageId: payload.imageId, alt: payload.alt },
      })
      .run();
  }

  private editor: Editor | null = null;
  // why: suppress the onUpdate -> output emission when we just pushed the
  //      same JSON back in from the input — avoids feedback loops in OnPush.
  private suppressEmit = false;

  constructor() {
    afterNextRender(() => this.mount());
  }

  private mount(): void {
    this.editor = new Editor({
      element: this.host().nativeElement,
      extensions: [StarterKit, createImageRefNode(this.reader)],
      content: this.value(),
      editable: this.editable(),
      onUpdate: ({ editor }) => {
        if (this.suppressEmit) return;
        this.valueChange.emit(editor.getJSON());
      },
    });

    effect(
      () => {
        const ed = this.editor;
        if (!ed) return;
        ed.setEditable(this.editable());
      },
      { injector: this.injector },
    );

    // why: keep external value in sync without forcing a remount on every
    //      keystroke; only reset when the incoming JSON actually differs.
    effect(
      () => {
        const next = this.value();
        const ed = this.editor;
        if (!ed) return;
        const current = ed.getJSON();
        if (jsonEquals(current, next)) return;
        this.suppressEmit = true;
        ed.commands.setContent(next, { emitUpdate: false });
        this.suppressEmit = false;
      },
      { injector: this.injector },
    );

    this.destroyRef.onDestroy(() => {
      this.editor?.destroy();
      this.editor = null;
    });
  }
}

// why: cheap structural equality; ProseMirror JSON is plain data so
//      JSON.stringify is fine for the size of notes we deal with.
const jsonEquals = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
