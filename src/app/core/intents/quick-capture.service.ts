import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { JSONContent } from '@tiptap/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { parseDetailUrl } from '@core/search/kind-routes';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { TagsAdminService } from '@core/tags/tags-admin.service';
import { TagsService } from '@core/tags/tags.service';

import type { GalleryImage } from '@features/images/models/gallery.types';
import { GalleriesService } from '@features/images/services/galleries.service';
import { NotesService } from '@features/notes/services/notes.service';
import type { Note } from '@features/notes/models/note.types';

// why: la nota/galería auto-creada siempre cae en la raíz del árbol — no
//      existe un concepto de "carpeta activa" persistente entre secciones.
const CAPTURE_FOLDER = '';

@Injectable({ providedIn: 'root' })
export class QuickCaptureService {
  private readonly shortcuts = inject(ShortcutsService);
  private readonly notes = inject(NotesService);
  private readonly galleries = inject(GalleriesService);
  private readonly tagsService = inject(TagsService);
  private readonly tagsAdmin = inject(TagsAdminService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly router = inject(Router);

  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  // why: resolved once per open() from the active route (see resolveContextTags)
  //      and shown as an editable chip in the dialog — never applied silently
  //      (rule "UI must not lie"). The user can add/remove before confirming.
  private readonly contextTagIdsSignal = signal<readonly string[]>([]);
  readonly contextTagIds = this.contextTagIdsSignal.asReadonly();
  readonly availableTags = this.tagsService.tags;

  private pasteListener: ((event: ClipboardEvent) => void) | null = null;

  constructor() {
    const dispose = this.shortcuts.register({
      combo: 'Alt+Shift+N',
      labelKey: 'shortcuts.quickCapture',
      scope: 'global',
      handler: () => this.openDialog(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  openDialog(): void {
    this.contextTagIdsSignal.set(this.resolveContextTags());
    this.openSignal.set(true);
    this.pasteListener = (event) => this.handlePaste(event);
    document.addEventListener('paste', this.pasteListener);
  }

  closeDialog(): void {
    this.openSignal.set(false);
    if (this.pasteListener) {
      document.removeEventListener('paste', this.pasteListener);
      this.pasteListener = null;
    }
  }

  async addContextTag(label: string): Promise<void> {
    try {
      const tag = await this.tagsService.touch(label);
      if (this.contextTagIdsSignal().includes(tag.id)) return;
      this.contextTagIdsSignal.update((ids) => [...ids, tag.id]);
    } catch (e) {
      this.errors.report(e);
    }
  }

  removeContextTag(id: string): void {
    this.contextTagIdsSignal.update((ids) => ids.filter((t) => t !== id));
  }

  async capture(text: string): Promise<void> {
    const lines = text.split('\n').map((l) => l.trim());
    const title = lines[0] ?? '';
    const bodyLines = lines.slice(1).filter((l) => l.length > 0);
    const tags = this.contextTagIdsSignal();
    if (!title && bodyLines.length === 0) {
      this.closeDialog();
      return;
    }
    try {
      const note = await this.notes.create(title, CAPTURE_FOLDER);
      const withBody = bodyLines.length > 0 ? { ...note, body: bodyDoc(bodyLines) } : note;
      const withTags = tags.length > 0 ? { ...withBody, tags } : withBody;
      const saved = withTags !== note ? await this.notes.save(withTags) : note;
      this.closeDialog();
      this.reportCreated(saved);
    } catch (e) {
      this.closeDialog();
      this.errors.report(e);
    }
  }

  // why: same route-based inference CreationIntentService uses to resolve
  //      the entity *kind* for Alt+N (see core/intents/creation-intent.service),
  //      extended with a lookup of that entity's tags via TagsAdminService's
  //      adapters — no new mechanism, just a second read off the same map.
  private resolveContextTags(): readonly string[] {
    const ref = parseDetailUrl(this.router.url);
    if (!ref) return [];
    return this.tagsAdmin.tagsForEntity(ref.kind, ref.id);
  }

  // why: reuses GalleriesContainer's clipboard-paste pattern (clipboardData.items,
  //      filter kind==='file' && type.startsWith('image/')) but wired here so it
  //      fires regardless of the page behind the dialog. Unlike that container,
  //      we don't skip when the target is inside the textarea — pasting an image
  //      into the quick-capture box *is* the image-capture gesture; plain text
  //      paste is unaffected since it has no file items to match.
  private handlePaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    const first = files[0];
    if (!first) return;
    event.preventDefault();
    void this.captureImage(first);
  }

  private async captureImage(file: File): Promise<void> {
    try {
      const galleryId = await this.resolveGalleryId();
      const image = await this.galleries.addImage(galleryId, file, file.name || 'captura.png');
      this.closeDialog();
      this.reportImageCaptured(galleryId, image);
    } catch (e) {
      this.closeDialog();
      this.errors.report(e);
    }
  }

  // why: product decision (docs/deferred/shortcuts-cross-section.md) — if no
  //      gallery exists tagged with the resolved context tag, auto-create one,
  //      zero friction, no picker step. Without a context tag (no open entity,
  //      or user hasn't added one manually), fall back to one stable untagged
  //      gallery reused across captures instead of inventing a tag.
  private async resolveGalleryId(): Promise<string> {
    const tagId = this.contextTagIdsSignal()[0];
    if (tagId) {
      const existing = this.galleries.summaries().find((g) => g.tags.includes(tagId));
      if (existing) return existing.id;
      const label = this.tagsService.byId(tagId)?.label ?? '';
      const created = await this.galleries.createGallery(label, CAPTURE_FOLDER);
      await this.galleries.saveGallery({ ...created, tags: [tagId] });
      return created.id;
    }
    const fallbackTitle = this.i18n.t('quickCapture.fallbackGalleryTitle');
    const existing = this.galleries.summaries().find((g) => g.title === fallbackTitle);
    if (existing) return existing.id;
    const created = await this.galleries.createGallery(fallbackTitle, CAPTURE_FOLDER);
    return created.id;
  }

  private reportCreated(note: Note): void {
    this.errors.report(
      new AppError(ERROR_CODES.UI_001, {
        severity: 'info',
        recoverable: false,
        context: { id: note.id },
        actions: [
          {
            labelKey: 'quickCapture.openNote',
            run: () => this.openNote(note),
          },
        ],
      }),
    );
  }

  private reportImageCaptured(galleryId: string, image: GalleryImage): void {
    this.errors.report(
      new AppError(ERROR_CODES.UI_001, {
        severity: 'info',
        recoverable: false,
        context: { id: image.id },
        actions: [
          {
            labelKey: 'quickCapture.openGallery',
            run: () => this.openGallery(galleryId),
          },
        ],
      }),
    );
  }

  private async openNote(note: Note): Promise<void> {
    await this.router.navigate(['/notes', entitySlugSegment(note.title, note.id)]);
  }

  private async openGallery(galleryId: string): Promise<void> {
    const title = this.galleries.summaries().find((g) => g.id === galleryId)?.title ?? '';
    await this.router.navigate(['/images', entitySlugSegment(title, galleryId)]);
  }
}

const bodyDoc = (lines: readonly string[]): JSONContent => ({
  type: 'doc',
  content: lines.map((line) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: line }],
  })),
});
