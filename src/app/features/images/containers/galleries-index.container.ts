import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, handleFolderAction } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { hashColor } from '@shared/utils/hash-color';
import { ROOM_SIZE, orderItems } from '@shared/utils/museum-asymmetry';

import { MuseumRoomComponent } from '../components/museum-room.component';
import type { Gallery, GalleryImage, GallerySummary } from '../models/gallery.types';
import { GalleriesService } from '../services/galleries.service';
import { formatAgoImages } from './format-ago-images';

type SortKey = 'recent' | 'title';

interface PlantCell {
  readonly summary: GallerySummary;
  readonly title: string;
  readonly subtitle: string;
  readonly tagLabels: readonly string[];
  readonly bg: string;
  readonly fg: string;
  readonly active: boolean;
}

@Component({
  selector: 'mc-galleries-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MuseumRoomComponent, FolderBreadcrumbComponent],
  templateUrl: './galleries-index.container.html',
  styleUrl: './galleries-index.container.css',
})
export class GalleriesIndexContainer {
  private readonly galleriesService = inject(GalleriesService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summaries = this.galleriesService.summaries;
  protected readonly tags = this.tagsService.tags;
  protected readonly query = signal<string>('');
  protected readonly sortKey = signal<SortKey>('recent');
  protected readonly tagFilter = signal<string>('');
  protected readonly activeRoomId = signal<string | null>(null);
  protected readonly activeGallery = signal<Gallery | null>(null);
  protected readonly previewUrls = signal<Record<string, string>>({});

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.galleriesService.folders;

  private readonly inCurrentFolder = computed<readonly GallerySummary[]>(() =>
    this.summaries().filter((s) => s.folder === this.currentFolder()),
  );

  protected readonly filteredSummaries = computed<readonly GallerySummary[]>(() => {
    const q = this.query().trim().toLowerCase();
    const filterTag = this.tagFilter();
    const sort = this.sortKey();
    const list = this.inCurrentFolder().filter((s) => {
      if (filterTag !== '' && !s.tags.includes(filterTag)) return false;
      if (q === '') return true;
      const title = (s.title || '').toLowerCase();
      if (title.includes(q)) return true;
      for (const tagId of s.tags) {
        const label = this.tagsService.byId(tagId)?.label.toLowerCase() ?? '';
        if (label.includes(q)) return true;
      }
      return false;
    });
    return [...list].sort((a, b) => {
      if (sort === 'title') {
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        return at.localeCompare(bt) || b.updatedAt.localeCompare(a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  });

  protected readonly cells = computed<readonly PlantCell[]>(() => {
    const active = this.activeRoomId();
    return this.filteredSummaries().map((s) => {
      const seed = s.tags[0] ?? s.id;
      const color = hashColor(seed);
      const ago = formatAgoImages(s.updatedAt, (k, p) => this.t(k, p));
      const count =
        s.imageCount === 0
          ? this.t('images.index.coverCount.empty')
          : s.imageCount === 1
            ? this.t('images.index.coverCount.one')
            : this.t('images.index.coverCount.many', { count: s.imageCount });
      return {
        summary: s,
        title: s.title || this.t('images.untitledTitle'),
        subtitle: ago ? `${count} · ${ago}` : count,
        tagLabels: s.tags
          .map((id) => this.tagsService.byId(id)?.label ?? '')
          .filter((l) => l !== ''),
        bg: color.bg,
        fg: color.fg,
        active: s.id === active,
      };
    });
  });

  protected readonly activeCell = computed<PlantCell | null>(() => {
    const id = this.activeRoomId();
    if (!id) return null;
    return this.cells().find((c) => c.summary.id === id) ?? null;
  });

  protected readonly previewImages = computed<readonly GalleryImage[]>(() => {
    const g = this.activeGallery();
    if (!g) return [];
    return orderItems(g.images, g.order).slice(0, ROOM_SIZE);
  });

  constructor() {
    // why: keep activeRoomId in sync with the filtered list so the preview always
    //      shows something. If the active was filtered out, fall back to the first.
    effect(() => {
      const list = this.filteredSummaries();
      const current = this.activeRoomId();
      if (list.length === 0) {
        if (current !== null) this.activeRoomId.set(null);
        return;
      }
      if (!current || !list.some((s) => s.id === current)) {
        this.activeRoomId.set(list[0]!.id);
      }
    });

    effect(() => {
      const id = this.activeRoomId();
      if (!id) {
        this.activeGallery.set(null);
        this.revokePreviewUrls();
        return;
      }
      void this.loadActiveGallery(id);
    });

    this.destroyRef.onDestroy(() => this.revokePreviewUrls());
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onQuery(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onSort(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const value = target.value === 'title' ? 'title' : 'recent';
    this.sortKey.set(value);
  }

  protected onTagFilter(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (target) this.tagFilter.set(target.value);
  }

  protected onSelectCell(id: string): void {
    this.activeRoomId.set(id);
  }

  protected onOpenActive(): void {
    const id = this.activeRoomId();
    if (!id) return;
    const title = this.summaries().find((s) => s.id === id)?.title ?? '';
    void this.router.navigate(['/images', entitySlugSegment(title, id, 'galeria')]);
  }

  protected openGallery(id: string, title: string): void {
    void this.router.navigate(['/images', entitySlugSegment(title, id, 'galeria')]);
  }

  protected onPreviewOpen(_imageId: string): void {
    this.onOpenActive();
  }

  protected async createGallery(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const gallery = await this.galleriesService.createGallery('', this.currentFolder());
      await this.router.navigate([
        '/images',
        entitySlugSegment(gallery.title, gallery.id, 'galeria'),
      ]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private async loadActiveGallery(id: string): Promise<void> {
    try {
      const gallery = await this.galleriesService.readGallery(id);
      if (this.activeRoomId() !== id) return;
      this.activeGallery.set(gallery);
      await this.refreshPreviewUrls(gallery);
    } catch (cause) {
      console.warn('[images-index] active gallery load failed', id, cause);
      this.activeGallery.set(null);
    }
  }

  private async refreshPreviewUrls(gallery: Gallery): Promise<void> {
    const slice = gallery.order.slice(0, ROOM_SIZE);
    const needed = new Set(slice);
    const current = this.previewUrls();
    const next: Record<string, string> = {};
    for (const [key, url] of Object.entries(current)) {
      if (needed.has(key)) {
        next[key] = url;
      } else {
        URL.revokeObjectURL(url);
      }
    }
    for (const imageId of slice) {
      if (next[imageId]) continue;
      try {
        const thumb = await this.galleriesService.readThumbBlob(gallery.id, imageId);
        const blob = thumb ?? (await this.galleriesService.readOriginalBlob(gallery.id, imageId));
        next[imageId] = URL.createObjectURL(blob);
      } catch (cause) {
        console.warn('[images-index] preview thumb failed', imageId, cause);
      }
    }
    this.previewUrls.set(next);
  }

  private revokePreviewUrls(): void {
    // why: called from inside effects — reading previewUrls() would register
    //      it as a tracked dep, and the subsequent .set({}) creates a new
    //      object ref that re-triggers the effect, causing an infinite loop.
    const urls = untracked(() => this.previewUrls());
    if (Object.keys(urls).length === 0) return;
    for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    this.previewUrls.set({});
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected async onCreateSubfolder(): Promise<void> {
    await handleCreateFolder('image', this.foldersService, this.i18n, this.currentFolder());
  }

  protected async onManageFolder(path: string): Promise<void> {
    await handleFolderAction(`image:${path}`, this.foldersService, this.i18n);
  }
}
