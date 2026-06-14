import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
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
import type { Editor, JSONContent } from '@tiptap/core';

import { ImageReaderService } from '@core/images/image-reader.service';
import { COMMENT_CLOUDS_META_KEY } from '@core/tiptap/comment-clouds/comment-clouds.ext';
import { DRAFT_DECORATIONS_META_KEY } from '@core/tiptap/draft-decorations/draft-decorations.ext';
import { IMAGE_REF_NAME } from '@core/tiptap/image-ref/image-ref.node';
import { CommentsService } from '@core/versioning/comments.service';
import type { Comment } from '@core/versioning/comments.types';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';

import { BubbleMenuComponent } from './bubble-menu.component';
import { CommentPopoverComponent } from './comment-popover.component';
import { CommentsPanelContainer } from './comments-panel.container';
import { DraftsPanelContainer } from './drafts-panel.container';
import { DraftSessionController } from './draft-session.controller';
import { EditorCommentsCoordinator } from './editor-comments.coordinator';
import { EditorToolbarComponent } from './editor-toolbar.component';
import { I18nService } from '@core/i18n/i18n.service';
import { ImagePickerDialogComponent } from './image-picker-dialog.component';
import {
  blockIdAtSelection,
  cloudRect,
  rangeWithinBlockAtSelection,
  selectionRect,
} from './editor-selection.utils';
import { createEditorInstance, jsonEquals } from './setup-editor';

@Component({
  selector: 'mc-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BubbleMenuComponent,
    CommentPopoverComponent,
    CommentsPanelContainer,
    DraftsPanelContainer,
    EditorToolbarComponent,
    ImagePickerDialogComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css',
})
export class EditorComponent {
  readonly value = input.required<JSONContent>();
  readonly placeholder = input<string>('');
  readonly editable = input<boolean>(true);
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
  private readonly comments = inject(CommentsService);

  protected readonly pickerOpen = signal(false);
  protected readonly view = signal<'clean' | 'combined'>('clean');
  protected readonly commentsIndexOpen = signal(false);
  protected readonly draftsIndexOpen = signal(false);
  protected readonly bubble = signal<{ top: number; left: number } | null>(null);
  protected readonly draftSession = new DraftSessionController({
    drafts: this.drafts,
    editor: () => this.editor,
    currentValue: () => this.value(),
    entityId: () => this.entityId(),
    entityTitle: () => this.entityTitle(),
    restoreView: (doc) => this.replaceContent(doc),
    onSaved: (n) => {
      this.draftSaved.emit(n);
      void this.loadDraftMarks(this.entityId());
    },
  });
  protected readonly commentsCoord = new EditorCommentsCoordinator({
    comments: this.comments,
    entityId: () => this.entityId(),
    entityTitle: () => this.entityTitle(),
    pushClouds: (list) => this.pushCommentClouds(list),
  });
  protected readonly commentPopover = this.commentsCoord.popover;
  private readonly draftMarks = signal<readonly DiffMark[]>([]);
  protected readonly commentsAvailable = computed(() => this.entityId().length > 0);
  protected readonly hasGalleries = computed(() => this.reader.summaries().length > 0);
  protected readonly showToolbar = computed(
    () => (this.editable() && this.hasGalleries()) || this.commentsAvailable(),
  );
  private editor: Editor | null = null;
  private suppressEmit = false;
  private selectingWithMouse = false;

  constructor() {
    afterNextRender(() => this.mount());
  }

  protected setView(next: 'clean' | 'combined'): void {
    if (this.view() === next) return;
    if (this.draftSession.active() && next === 'clean') void this.draftSession.end();
    this.view.set(next);
    this.bubble.set(null);
    if (next === 'clean') {
      this.commentsCoord.dismiss();
      this.commentsIndexOpen.set(false);
      this.draftsIndexOpen.set(false);
    }
  }

  protected onDraftMarksChange(marks: readonly DiffMark[]): void {
    this.draftMarks.set(marks);
  }

  protected onAcceptApply(next: JSONContent): void {
    this.replaceContent(next);
    this.valueChange.emit(next);
    void this.loadDraftMarks(this.entityId());
  }

  // why: gate (4) of 13f — Alt+C/Alt+P are the entry from `clean` (the
  //      bubble only shows in `combined`). Same triggers also handle the
  //      bubble click path; refocus the editor afterwards because the
  //      bubble button stole focus.
  protected triggerComment(): void {
    this.bubble.set(null);
    const ed = this.editor;
    if (!ed || !this.commentsAvailable() || !this.hasNonEmptySelection(ed)) return;
    this.ensureCombined();
    this.commentsCoord.openNew(
      blockIdAtSelection(ed),
      selectionRect(ed, this.host().nativeElement),
      rangeWithinBlockAtSelection(ed),
    );
  }

  protected triggerPropose(): void {
    this.bubble.set(null);
    const ed = this.editor;
    if (!ed || !this.commentsAvailable() || !this.hasNonEmptySelection(ed)) return;
    this.ensureCombined();
    this.draftSession.start();
    ed.commands.focus();
  }

  @HostListener('document:keydown', ['$event'])
  protected onShortcut(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target as Node | null;
    if (!target || !this.host().nativeElement.contains(target)) return;
    const key = event.key.toLowerCase();
    if (key !== 'c' && key !== 'p') return;
    event.preventDefault();
    if (key === 'c') this.triggerComment();
    else this.triggerPropose();
  }

  private hasNonEmptySelection(ed: Editor): boolean {
    const { from, to } = ed.state.selection;
    return from !== to;
  }

  protected onOpenCommentFromIndex(commentId: string): void {
    this.commentsCoord.openExisting(commentId, cloudRect(this.host().nativeElement, commentId));
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.draftSession.active()) return void this.draftSession.end();
    if (this.commentPopover() !== null) return this.commentsCoord.dismiss();
    if (this.bubble() !== null) this.bubble.set(null);
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocumentMouseDown(event: MouseEvent): void {
    const target = event.target as Node | null;
    const hostEl = this.host().nativeElement;
    if (target && hostEl.contains(target)) {
      // why: hide the bubble while the user is actively dragging a
      //      selection; it would otherwise flicker on every range update.
      this.selectingWithMouse = true;
      this.bubble.set(null);
      return;
    }
    if (this.draftSession.active()) void this.draftSession.end();
    if (this.commentPopover() !== null) {
      const popoverEl = (event.target as HTMLElement | null)?.closest('mc-comment-popover');
      if (!popoverEl) this.commentsCoord.dismiss();
    }
  }

  @HostListener('document:mouseup')
  protected onDocumentMouseUp(): void {
    if (!this.selectingWithMouse) return;
    this.selectingWithMouse = false;
    const ed = this.editor;
    if (!ed) return;
    this.onEditorSelectionUpdate(ed);
  }

  protected onPicked(payload: { galleryId: string; imageId: string; alt: string }): void {
    this.pickerOpen.set(false);
    this.editor?.chain().focus().insertContent({ type: IMAGE_REF_NAME, attrs: payload }).run();
  }

  private ensureCombined(): void {
    if (this.view() !== 'combined') this.view.set('combined');
  }

  private pushCommentClouds(list: readonly Comment[]): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(COMMENT_CLOUDS_META_KEY, list));
  }

  private async loadDraftMarks(id: string): Promise<void> {
    if (!id) return this.draftMarks.set([]);
    const file = await this.drafts.read(id);
    if (this.entityId() === id) this.draftMarks.set(file.marks);
  }

  private pushDraftDecorations(marks: readonly DiffMark[]): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(DRAFT_DECORATIONS_META_KEY, marks));
  }

  private replaceContent(doc: JSONContent): void {
    if (!this.editor) return;
    this.suppressEmit = true;
    this.editor.commands.setContent(doc, { emitUpdate: false });
    this.suppressEmit = false;
  }

  private onEditorUpdate(ed: Editor): void {
    if (this.suppressEmit) return;
    const json = ed.getJSON();
    if (this.draftSession.captureUpdate(json)) return;
    this.valueChange.emit(json);
  }

  private onEditorSelectionUpdate(ed: Editor): void {
    const { from, to } = ed.state.selection;
    const showBubble =
      this.view() === 'combined' &&
      !this.draftSession.active() &&
      !this.selectingWithMouse &&
      from !== to;
    this.bubble.set(showBubble ? selectionRect(ed, this.host().nativeElement) : null);
  }

  private mount(): void {
    this.editor = createEditorInstance({
      element: this.host().nativeElement,
      reader: this.reader,
      initialContent: this.value(),
      editable: this.editable(),
      onCloudClick: (id) =>
        this.commentsCoord.openExisting(id, cloudRect(this.host().nativeElement, id)),
      cloudAriaLabel: () => this.i18n.t('editor.cloud.aria'),
      onUpdate: (ed) => this.onEditorUpdate(ed),
      onSelectionUpdate: (ed) => this.onEditorSelectionUpdate(ed),
    });

    const opts = { injector: this.injector };
    effect(() => this.editor?.setEditable(this.editable()), opts);
    effect(() => void this.commentsCoord.loadFor(this.entityId()), opts);
    effect(() => void this.loadDraftMarks(this.entityId()), opts);
    effect(() => {
      const next = this.value();
      const ed = this.editor;
      if (!ed || this.draftSession.active() || jsonEquals(ed.getJSON(), next)) return;
      this.suppressEmit = true;
      ed.commands.setContent(next, { emitUpdate: false });
      this.suppressEmit = false;
    }, opts);
    const combined = (): boolean => this.view() === 'combined';
    effect(() => this.pushCommentClouds(combined() ? this.commentsCoord.list() : []), opts);
    effect(() => this.pushDraftDecorations(combined() ? this.draftMarks() : []), opts);

    this.destroyRef.onDestroy(() => {
      void this.draftSession.flushPending();
      this.editor?.destroy();
      this.editor = null;
    });
  }
}
