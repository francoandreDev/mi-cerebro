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
import { Router } from '@angular/router';
import type { Editor, JSONContent } from '@tiptap/core';

import { ImageReaderService } from '@core/images/image-reader.service';
import { RelationsService } from '@core/relations/relations.service';
import { routeFor } from '@core/search/kind-routes';
import { BOOKMARK_PIN_META_KEY } from '@core/tiptap/bookmark-pin/bookmark-pin.ext';
import { COMMENT_CLOUDS_META_KEY } from '@core/tiptap/comment-clouds/comment-clouds.ext';
import { COMMENT_RANGE_MAPPING_META_KEY } from '@core/tiptap/comment-range-mapping/comment-range-mapping.ext';
import { DRAFT_DECORATIONS_META_KEY } from '@core/tiptap/draft-decorations/draft-decorations.ext';
import {
  ENTITY_REF_NAME,
  type EntityRefOpenPayload,
} from '@core/tiptap/entity-ref/entity-ref.node';
import { IMAGE_REF_NAME } from '@core/tiptap/image-ref/image-ref.node';
import { TTS_HIGHLIGHT_META_KEY } from '@core/tiptap/tts-highlight/tts-highlight.ext';
import { TYPEWRITER_FOCUS_META_KEY } from '@core/tiptap/typewriter-focus/typewriter-focus.ext';
import { CommentsService } from '@core/versioning/comments.service';
import type { Comment } from '@core/versioning/comments.types';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';
import { VariantsService } from '@core/versioning/variants.service';

import { BubbleMenuComponent } from './bubble-menu.component';
import { CommentPopoverComponent } from './comment-popover.component';
import { CommentsPanelContainer } from './comments-panel.container';
import { DraftsPanelContainer } from './drafts-panel.container';
import { DraftSessionController } from './draft-session.controller';
import { EditorCommentsCoordinator } from './editor-comments.coordinator';
import { EditorToolbarComponent } from './editor-toolbar.component';
import type { EntityLinkPicked } from './entity-link-picker-dialog.component';
import { EntityLinkPickerDialogComponent } from './entity-link-picker-dialog.component';
import { TypewriterModeService } from './typewriter-mode.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ImagePickerDialogComponent } from './image-picker-dialog.component';
import {
  blockIdAtSelection,
  blockSpanAtSelection,
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
    EntityLinkPickerDialogComponent,
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
  // why: kind de la entidad activa (ej. 'note', 'goal') — necesario para
  //      registrar el extremo `from` de una Relation al vincular desde el
  //      editor (§10bis). Vacío = "Vincular a…" no crea la Relation (sólo
  //      pasaría en un consumidor nuevo de mc-editor que no lo declare).
  readonly entityKind = input<string>('');
  // why: marcador de párrafo — opt-in porque el resto de entidades que usan
  //      mc-editor (notas, tareas, etc.) no lo necesitan. Ver book-reader/
  //      chapter-editor-pane, únicos consumidores hoy.
  readonly bookmarkable = input<boolean>(false);
  readonly bookmarkedBlockId = input<string | null>(null);
  // why: id del bloque que está leyendo TtsService — null cuando no hay
  //      lectura en curso. Ver tts-highlight.ext.ts para el porqué de la
  //      decoration en vez de una clase puesta a mano.
  readonly ttsHighlightBlockId = input<string | null>(null);
  readonly valueChange = output<JSONContent>();
  readonly draftSaved = output<number>();
  readonly bookmarkToggle = output<string>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reader = inject(ImageReaderService);
  private readonly i18n = inject(I18nService);
  private readonly drafts = inject(DraftsService);
  private readonly comments = inject(CommentsService);
  private readonly variants = inject(VariantsService);
  private readonly relations = inject(RelationsService);
  private readonly router = inject(Router);
  protected readonly typewriterMode = inject(TypewriterModeService);

  protected readonly pickerOpen = signal(false);
  protected readonly linkPickerOpen = signal(false);
  private pendingLinkRange: { from: number; to: number; text: string } | null = null;
  protected readonly view = signal<'clean' | 'combined'>('clean');
  protected readonly commentsIndexOpen = signal(false);
  protected readonly draftsIndexOpen = signal(false);
  protected readonly draftFocusId = signal<string | null>(null);
  protected readonly bubble = signal<{ top: number; left: number } | null>(null);
  protected readonly bulletListActive = signal(false);
  protected readonly orderedListActive = signal(false);
  protected readonly boldActive = signal(false);
  protected readonly italicActive = signal(false);
  protected readonly activeHeadingLevel = signal<2 | 3 | 4 | 0>(0);
  protected readonly citationActive = signal(false);
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
    t: (key) => this.i18n.t(key),
  });
  protected readonly commentPopover = this.commentsCoord.popover;
  private readonly draftMarks = signal<readonly DiffMark[]>([]);
  protected readonly commentsAvailable = computed(() => this.entityId().length > 0);
  // why: names the real git branch the editor is about to commit to — see
  //      variants.types.ts (family of 3 branches). Alt+P/Alt+C don't just
  //      toggle a view, they write real commits onto draft/comments, and
  //      before this the only place that said "branch" out loud was a
  //      history tooltip. `branchWriteMode` + `activeVariantName` feed the
  //      chrome badge that makes that explicit at the point of writing.
  private readonly activeVariantName = computed(() => {
    const file = this.variants.file();
    return file.variants.find((v) => v.id === file.activeId)?.name ?? '';
  });
  protected readonly branchWriteMode = computed<'draft' | 'comment' | null>(() => {
    if (this.draftSession.active()) return 'draft';
    if (this.commentPopover() !== null) return 'comment';
    return null;
  });
  protected readonly branchBadgeText = computed<string | null>(() => {
    const mode = this.branchWriteMode();
    if (!mode) return null;
    const name = this.activeVariantName();
    return mode === 'draft'
      ? this.i18n.t('drafts.session.branchBadge', { name })
      : this.i18n.t('comments.session.branchBadge', { name });
  });
  protected readonly hasGalleries = computed(() => this.reader.summaries().length > 0);
  protected readonly showToolbar = computed(() => this.editable() || this.commentsAvailable());
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
  // why: public so external toolbars (e.g. the book chapter pane's own
  //      chrome, which mirrors mc-editor-toolbar since that's display:none
  //      inside book pagination) can trigger the same comment/propose flow
  //      that Alt+C/Alt+P already do internally.
  triggerComment(): void {
    this.bubble.set(null);
    const ed = this.editor;
    if (!ed || !this.commentsAvailable() || !this.hasNonEmptySelection(ed)) return;
    this.ensureCombined();
    // 19.16e-iii — a selection crossing blocks reports a span instead of a
    //      single blockId/range pair.
    const span = blockSpanAtSelection(ed);
    this.commentsCoord.openNew(
      span ? null : blockIdAtSelection(ed),
      selectionRect(ed, this.host().nativeElement),
      span ? null : rangeWithinBlockAtSelection(ed),
      span,
    );
  }

  triggerPropose(): void {
    this.bubble.set(null);
    const ed = this.editor;
    if (!ed || !this.commentsAvailable() || !this.hasNonEmptySelection(ed)) return;
    this.ensureCombined();
    this.draftSession.start();
    ed.commands.focus();
  }

  // why: a diferencia de propose/comment, vincular no es una operación de
  //      rama (§10bis) — no llama ensureCombined(), funciona igual en
  //      `clean` que en `combined`. Llegan acá dos entradas: la bubble
  //      (siempre con selección, sólo visible en combined) y el botón fijo
  //      del toolbar (visible siempre, con o sin selección — sin selección
  //      inserta el chip en el cursor en vez de envolver texto). Guarda
  //      from/to/text ahora porque abrir el picker le saca el foco al
  //      editor y la selección de ProseMirror puede colapsar.
  triggerLink(): void {
    this.bubble.set(null);
    const ed = this.editor;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    this.pendingLinkRange = { from, to, text: ed.state.doc.textBetween(from, to, ' ') };
    this.linkPickerOpen.set(true);
  }

  protected onEntityLinked(picked: EntityLinkPicked): void {
    this.linkPickerOpen.set(false);
    const range = this.pendingLinkRange;
    this.pendingLinkRange = null;
    const ed = this.editor;
    if (!ed || !range) return;
    ed.chain()
      .focus()
      .insertContentAt(
        { from: range.from, to: range.to },
        {
          type: ENTITY_REF_NAME,
          attrs: { kind: picked.kind, entityId: picked.id, label: picked.label },
        },
      )
      .run();
    const kind = this.entityKind();
    const id = this.entityId();
    if (kind && id) {
      void this.relations.create({
        from: { kind, id },
        to: { kind: picked.kind, id: picked.id },
        origin: 'editor',
        contextSnippet: range.text,
      });
    }
  }

  // why: toolbar buttons (unlike Alt+C/Alt+P, pressed while a selection is
  //      naturally active) can be clicked with no selection — expose this
  //      so callers can disable/hint instead of silently no-op'ing.
  hasCommentableSelection(): boolean {
    return this.bubble() !== null;
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

  // 19.16e-iv — clicking the inline ghost widget for an insertion-only
  //      diff-mark opens the drafts popover pre-selected on that mark.
  protected onDraftInsertClick(markId: string): void {
    this.draftFocusId.set(markId);
    this.draftsIndexOpen.set(true);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.draftSession.active()) {
      event.preventDefault();
      return void this.draftSession.end();
    }
    if (this.commentPopover() !== null) {
      event.preventDefault();
      return this.commentsCoord.dismiss();
    }
    if (this.bubble() !== null) {
      event.preventDefault();
      this.bubble.set(null);
    }
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

  protected applyHighlight(color: string | null): void {
    const ed = this.editor;
    if (!ed) return;
    if (color === null) ed.chain().focus().unsetHighlight().run();
    else ed.chain().focus().toggleHighlight({ color }).run();
  }

  // why: not just `protected` — books' chapter-editor-pane hides the
  //      in-shell toolbar entirely (CSS multicol pagination can't carry
  //      it, see _book-editor.scss) and drives list toggling from its own
  //      chrome instead, via a ViewChild reference to this component.
  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  isBulletListActive(): boolean {
    return this.bulletListActive();
  }

  isOrderedListActive(): boolean {
    return this.orderedListActive();
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  isBoldActive(): boolean {
    return this.boldActive();
  }

  isItalicActive(): boolean {
    return this.italicActive();
  }

  insertSceneBreak(): void {
    this.editor?.chain().focus().setHorizontalRule().run();
  }

  // why: levels capped at 2-4 — the chapter title (books) / entity title
  //      already reads as the de-facto H1, so H1 stays out of the schema
  //      entirely (see setup-editor.ts's `levels: [2, 3, 4]`).
  setHeadingLevel(level: 2 | 3 | 4): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  isHeadingLevelActive(level: 2 | 3 | 4): boolean {
    return this.activeHeadingLevel() === level;
  }

  toggleCitation(): void {
    this.editor?.chain().focus().toggleCitation().run();
  }

  isCitationActive(): boolean {
    return this.citationActive();
  }

  // why: books' chapter-editor-pane hides the in-shell toolbar entirely
  //      (mismo motivo que toggleBulletList/etc arriba) y necesita disparar
  //      el picker de imágenes desde su propio ui-bar.
  openImagePicker(): void {
    this.pickerOpen.set(true);
  }

  hasImageGalleries(): boolean {
    return this.hasGalleries();
  }

  private refreshListActiveState(ed: Editor): void {
    this.bulletListActive.set(ed.isActive('bulletList'));
    this.orderedListActive.set(ed.isActive('orderedList'));
    this.boldActive.set(ed.isActive('bold'));
    this.italicActive.set(ed.isActive('italic'));
    this.activeHeadingLevel.set(
      ed.isActive('heading', { level: 2 })
        ? 2
        : ed.isActive('heading', { level: 3 })
          ? 3
          : ed.isActive('heading', { level: 4 })
            ? 4
            : 0,
    );
    this.citationActive.set(ed.isActive('citation'));
  }

  private ensureCombined(): void {
    if (this.view() !== 'combined') this.view.set('combined');
  }

  private pushCommentClouds(list: readonly Comment[]): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(COMMENT_CLOUDS_META_KEY, list));
  }

  // why: unlike the cloud decorations (only rendered in `combined`), range
  //      mapping must track edits regardless of the active view — the user
  //      can keep typing in `clean` while a comment stays anchored.
  private pushCommentRangeMapping(list: readonly Comment[]): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(COMMENT_RANGE_MAPPING_META_KEY, list));
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
    this.refreshListActiveState(ed);
    if (this.suppressEmit) return;
    const json = ed.getJSON();
    if (this.draftSession.captureUpdate(json)) return;
    this.valueChange.emit(json);
  }

  // why: el marcador de párrafo es un plugin real de ProseMirror
  //      (bookmark-pin.ext.ts) — igual que los comment clouds, cualquier
  //      DOM inyectado a mano por fuera del modelo de ProseMirror
  //      desaparece en la próxima transacción (el reconciliador reescribe
  //      el subárbol del nodo). Este método sólo empuja el blockId actual
  //      como metadata; el plugin decide la decoración.
  private pushBookmarkPin(): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(BOOKMARK_PIN_META_KEY, this.bookmarkedBlockId()));
  }

  private pushTtsHighlight(): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(TTS_HIGHLIGHT_META_KEY, this.ttsHighlightBlockId()));
  }

  private pushTypewriterFocus(): void {
    const view = this.editor?.view;
    view?.dispatch(view.state.tr.setMeta(TYPEWRITER_FOCUS_META_KEY, this.typewriterMode.active()));
  }

  protected toggleTypewriterMode(): void {
    this.typewriterMode.toggle();
  }

  private onEditorSelectionUpdate(ed: Editor): void {
    this.refreshListActiveState(ed);
    const { from, to } = ed.state.selection;
    const showBubble =
      this.view() === 'combined' &&
      !this.draftSession.active() &&
      !this.selectingWithMouse &&
      from !== to;
    this.bubble.set(showBubble ? selectionRect(ed, this.host().nativeElement) : null);
  }

  private mount(): void {
    // why: extensions like block-id can normalize the doc (e.g. assign
    // missing ids) via an appendTransaction right after construction, which
    // fires onUpdate for content nobody actually edited — suppress it same
    // as any other programmatic setContent, or the UI flashes "unsaved".
    this.suppressEmit = true;
    this.editor = createEditorInstance({
      element: this.host().nativeElement,
      reader: this.reader,
      initialContent: this.value(),
      editable: this.editable(),
      citationAttributionPlaceholders: {
        author: () => this.i18n.t('editor.citation.authorPlaceholder'),
        year: () => this.i18n.t('editor.citation.yearPlaceholder'),
      },
      onCloudClick: (id) =>
        this.commentsCoord.openExisting(id, cloudRect(this.host().nativeElement, id)),
      cloudAriaLabel: () => this.i18n.t('editor.cloud.aria'),
      onDraftInsertClick: (markId) => this.onDraftInsertClick(markId),
      draftInsertAriaLabel: () => this.i18n.t('editor.draftInsert.aria'),
      onUpdate: (ed) => this.onEditorUpdate(ed),
      onSelectionUpdate: (ed) => this.onEditorSelectionUpdate(ed),
      getComments: () => this.commentsCoord.list(),
      onRangesMapped: (updates) => this.commentsCoord.applyRangeUpdates(updates),
      isBookmarkable: () => this.bookmarkable(),
      onBookmarkToggle: (blockId) => this.bookmarkToggle.emit(blockId),
      bookmarkPinAriaLabel: () => this.i18n.t('editor.bookmark.set'),
      bookmarkMarkerAriaLabel: () => this.i18n.t('editor.bookmark.unset'),
      onEntityRefOpen: (payload: EntityRefOpenPayload) =>
        void this.router.navigate([...routeFor(payload.kind, payload.entityId, payload.label)]),
    });
    this.suppressEmit = false;

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
    effect(() => this.pushCommentRangeMapping(this.commentsCoord.list()), opts);
    effect(() => this.pushDraftDecorations(combined() ? this.draftMarks() : []), opts);
    effect(() => {
      this.bookmarkedBlockId();
      this.pushBookmarkPin();
    }, opts);
    effect(() => {
      this.ttsHighlightBlockId();
      this.pushTtsHighlight();
    }, opts);
    effect(() => {
      this.typewriterMode.active();
      this.pushTypewriterFocus();
    }, opts);

    this.destroyRef.onDestroy(() => {
      void this.draftSession.flushPending();
      this.editor?.destroy();
      this.editor = null;
    });
  }
}
