import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
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
import { createBlockIdExtension } from '@core/tiptap/block-id/block-id.ext';
import {
  DRAFT_DECORATIONS_META_KEY,
  createDraftDecorationsExtension,
} from '@core/tiptap/draft-decorations/draft-decorations.ext';
import { IMAGE_REF_NAME, createImageRefNode } from '@core/tiptap/image-ref/image-ref.node';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';

import { CommentsPanelContainer } from './comments-panel.container';
import { DraftsPanelContainer } from './drafts-panel.container';
import { EditorDraftModeController } from './editor-draft-mode.controller';
import { ImagePickerDialogComponent } from './image-picker-dialog.component';

@Component({
  selector: 'mc-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentsPanelContainer, DraftsPanelContainer, ImagePickerDialogComponent],
  template: `
    @if (showToolbar()) {
      <div class="toolbar">
        @if (editable() && hasGalleries()) {
          <button
            type="button"
            class="ghost"
            (click)="openPicker()"
            [attr.aria-label]="t('editor.insertImage')"
          >
            🖼 {{ t('editor.insertImage') }}
          </button>
        }
        @if (commentsAvailable()) {
          <button
            type="button"
            class="ghost"
            (click)="togglePanel()"
            [attr.aria-pressed]="panelOpen()"
            [attr.aria-label]="panelOpen() ? t('comments.toggle.close') : t('comments.toggle.open')"
          >
            💬 {{ t('comments.toggle.label') }}
          </button>
        }
        @if (commentsAvailable() && editable()) {
          <button
            type="button"
            class="ghost"
            (click)="toggleDraft()"
            [attr.aria-pressed]="draftMode()"
            [attr.aria-label]="draftMode() ? t('editor.draftMode.off') : t('editor.draftMode.on')"
          >
            📝 {{ t('editor.draftMode.label') }}
          </button>
        }
        @if (draftMode()) {
          <button type="button" class="ghost" (click)="saveDraft()" [disabled]="savingDraft()">
            {{ savingDraft() ? t('editor.draftMode.saving') : t('editor.draftMode.save') }}
          </button>
        }
        @if (lastDraftSaveCount() !== null) {
          <span class="saved-flash" role="status" aria-live="polite">
            ✓ {{ t('editor.draftMode.saved') }} ({{ lastDraftSaveCount() }})
          </span>
        }
        @if (commentsAvailable()) {
          <button
            type="button"
            class="ghost"
            (click)="toggleDraftsPanel()"
            [attr.aria-pressed]="draftsPanelOpen()"
            [attr.aria-label]="
              draftsPanelOpen() ? t('drafts.toggle.close') : t('drafts.toggle.open')
            "
          >
            📋 {{ t('drafts.toggle.label') }}
          </button>
        }
      </div>
    }
    <div class="shell" [class.has-panel]="panelOpen()">
      <div #host class="editor-host" data-testid="editor-host"></div>
      @if (commentsAvailable() && panelOpen()) {
        <mc-comments-panel
          [entityId]="entityId()"
          [entityTitle]="entityTitle()"
          [value]="value()"
          (closed)="closePanel()"
        />
      }
      @if (commentsAvailable() && draftsPanelOpen()) {
        <mc-drafts-panel
          [entityId]="entityId()"
          [entityTitle]="entityTitle()"
          [value]="value()"
          (closed)="closeDraftsPanel()"
          (applyToDoc)="onAcceptApply($event)"
          (marksChange)="onDraftMarksChange($event)"
        />
      }
    </div>
    @if (pickerOpen()) {
      <mc-image-picker-dialog (picked)="onPicked($event)" (dismiss)="closePicker()" />
    }
  `,
  styleUrl: './editor.component.css',
})
export class EditorComponent {
  readonly value = input.required<JSONContent>();
  readonly placeholder = input<string>('');
  readonly editable = input<boolean>(true);
  // why: comments/drafts panels are gated on a non-empty entityId — keeps
  //      the shared editor usable in transient contexts (preview dialogs).
  readonly entityId = input<string>('');
  readonly entityTitle = input<string>('');
  readonly valueChange = output<JSONContent>();
  readonly draftSaved = output<number>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reader = inject(ImageReaderService);
  private readonly i18n = inject(I18nService);
  private readonly drafts = inject(DraftsService);

  protected readonly pickerOpen = signal(false);
  protected readonly panelOpen = signal(false);
  protected readonly draftsPanelOpen = signal(false);
  private readonly draftCtrl = new EditorDraftModeController({
    drafts: this.drafts,
    editor: () => this.editor,
    currentValue: () => this.value(),
    entityId: () => this.entityId(),
    entityTitle: () => this.entityTitle(),
    restoreView: (doc) => this.replaceContent(doc),
    onSaved: (n) => this.draftSaved.emit(n),
  });
  protected readonly draftMode = this.draftCtrl.active;
  protected readonly savingDraft = this.draftCtrl.saving;
  protected readonly lastDraftSaveCount = this.draftCtrl.lastSaveCount;
  private readonly draftMarks = signal<readonly DiffMark[]>([]);
  protected readonly commentsAvailable = computed(() => this.entityId().length > 0);
  protected readonly showToolbar = computed(
    () => (this.editable() && this.hasGalleries()) || this.commentsAvailable(),
  );
  protected readonly hasGalleries = (): boolean => this.reader.summaries().length > 0;

  protected t(key: Parameters<I18nService['t']>[0]): string {
    return this.i18n.t(key);
  }

  protected openPicker = (): void => this.pickerOpen.set(true);
  protected closePicker = (): void => this.pickerOpen.set(false);

  protected togglePanel = (): void => this.panelOpen.update((v) => !v);
  protected closePanel = (): void => this.panelOpen.set(false);
  protected toggleDraftsPanel = (): void => this.draftsPanelOpen.update((v) => !v);
  protected closeDraftsPanel = (): void => this.draftsPanelOpen.set(false);

  protected onDraftMarksChange(marks: readonly DiffMark[]): void {
    this.draftMarks.set(marks);
    this.pushDecorations(marks);
  }

  protected onAcceptApply(next: JSONContent): void {
    this.replaceContent(next);
    this.valueChange.emit(next);
  }

  protected toggleDraft = (): void => this.draftCtrl.toggle();
  protected saveDraft = (): Promise<void> => this.draftCtrl.save();

  private replaceContent(doc: JSONContent): void {
    const ed = this.editor;
    if (!ed) return;
    this.suppressEmit = true;
    ed.commands.setContent(doc, { emitUpdate: false });
    this.suppressEmit = false;
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
      extensions: [
        StarterKit,
        createBlockIdExtension(),
        createImageRefNode(this.reader),
        createDraftDecorationsExtension(),
      ],
      content: this.value(),
      editable: this.editable(),
      onUpdate: ({ editor }) => {
        if (this.suppressEmit) return;
        const json = editor.getJSON();
        if (this.draftCtrl.captureUpdate(json)) return;
        this.valueChange.emit(json);
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
    //      Skips entirely while draft mode is on so the buffer survives.
    effect(
      () => {
        const next = this.value();
        const ed = this.editor;
        if (!ed) return;
        if (this.draftMode()) return;
        const current = ed.getJSON();
        if (jsonEquals(current, next)) return;
        this.suppressEmit = true;
        ed.commands.setContent(next, { emitUpdate: false });
        this.suppressEmit = false;
      },
      { injector: this.injector },
    );

    // why: replay marks if they arrived from the panel before mount.
    if (this.draftMarks().length > 0) this.pushDecorations(this.draftMarks());

    this.destroyRef.onDestroy(() => {
      this.editor?.destroy();
      this.editor = null;
    });
  }

  private pushDecorations(marks: readonly DiffMark[]): void {
    const ed = this.editor;
    if (!ed) return;
    const view = ed.view;
    view.dispatch(view.state.tr.setMeta(DRAFT_DECORATIONS_META_KEY, marks));
  }
}

// why: cheap structural equality; ProseMirror JSON is plain data so
//      JSON.stringify is fine for the size of notes we deal with.
const jsonEquals = (a: JSONContent, b: JSONContent): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
