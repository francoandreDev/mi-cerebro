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
  viewChild,
} from '@angular/core';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

@Component({
  selector: 'mc-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="editor-host" data-testid="editor-host"></div>`,
  styles: `
    :host {
      display: block;
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
      extensions: [StarterKit],
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
