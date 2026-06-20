import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';

import { GalleryCoverComponent } from '../components/gallery-cover.component';
import type { GallerySummary } from '../models/gallery.types';
import { GalleriesService } from '../services/galleries.service';
import { formatAgoImages } from './format-ago-images';

type SortKey = 'recent' | 'title';

interface GalleryView {
  readonly summary: GallerySummary;
  readonly subtitle: string;
  readonly tagLabels: readonly string[];
}

@Component({
  selector: 'mc-galleries-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GalleryCoverComponent, IconComponent],
  templateUrl: './galleries-index.container.html',
  styleUrl: './galleries-index.container.css',
})
export class GalleriesIndexContainer {
  private readonly galleriesService = inject(GalleriesService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summaries = this.galleriesService.summaries;
  protected readonly tags = this.tagsService.tags;
  protected readonly query = signal<string>('');
  protected readonly sortKey = signal<SortKey>('recent');
  protected readonly tagFilter = signal<string>('');
  protected readonly thumbUrls = signal<Record<string, string>>({});

  protected readonly views = computed<readonly GalleryView[]>(() => {
    const q = this.query().trim().toLowerCase();
    const filterTag = this.tagFilter();
    const sort = this.sortKey();
    const list = this.summaries().filter((s) => {
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
    const sorted = [...list].sort((a, b) => {
      if (sort === 'title') {
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        return at.localeCompare(bt) || b.updatedAt.localeCompare(a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return sorted.map((s) => this.toView(s));
  });

  constructor() {
    effect(() => {
      const needed = new Set<string>();
      for (const v of this.views()) {
        for (const id of v.summary.coverImageIds) needed.add(`${v.summary.id}:${id}`);
      }
      this.syncThumbs(needed).catch((e) => console.warn('[images-index] thumb sync failed', e));
    });
    this.destroyRef.onDestroy(() => this.revokeAll());
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected coverUrlsFor(summary: GallerySummary): Record<string, string> {
    const all = this.thumbUrls();
    const out: Record<string, string> = {};
    for (const id of summary.coverImageIds) {
      const url = all[`${summary.id}:${id}`];
      if (url) out[id] = url;
    }
    return out;
  }

  protected moreLabelFor(summary: GallerySummary): string {
    const extra = Math.max(0, summary.imageCount - summary.coverImageIds.length);
    return this.t('images.index.coverMore', { count: extra });
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

  protected openGallery(id: string): void {
    void this.router.navigate(['/images', id]);
  }

  protected async createGallery(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const gallery = await this.galleriesService.createGallery('');
      await this.router.navigate(['/images', gallery.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private toView(summary: GallerySummary): GalleryView {
    const ago = formatAgoImages(summary.updatedAt, (k, p) => this.t(k, p));
    const count =
      summary.imageCount === 0
        ? this.t('images.index.coverCount.empty')
        : summary.imageCount === 1
          ? this.t('images.index.coverCount.one')
          : this.t('images.index.coverCount.many', { count: summary.imageCount });
    const subtitle = ago ? `${count} · ${ago}` : count;
    const tagLabels = summary.tags
      .map((id) => this.tagsService.byId(id)?.label ?? '')
      .filter((l) => l !== '');
    return { summary, subtitle, tagLabels };
  }

  private async syncThumbs(needed: Set<string>): Promise<void> {
    const current = this.thumbUrls();
    const next: Record<string, string> = { ...current };
    let changed = false;
    for (const key of Object.keys(current)) {
      if (!needed.has(key)) {
        URL.revokeObjectURL(current[key]!);
        delete next[key];
        changed = true;
      }
    }
    for (const key of needed) {
      if (next[key]) continue;
      const sepIdx = key.indexOf(':');
      const galleryId = key.slice(0, sepIdx);
      const imageId = key.slice(sepIdx + 1);
      try {
        const thumb = await this.galleriesService.readThumbBlob(galleryId, imageId);
        const blob = thumb ?? (await this.galleriesService.readOriginalBlob(galleryId, imageId));
        next[key] = URL.createObjectURL(blob);
        changed = true;
      } catch (cause) {
        console.warn('[images-index] thumb load failed', key, cause);
      }
    }
    if (changed) this.thumbUrls.set(next);
  }

  private revokeAll(): void {
    for (const url of Object.values(this.thumbUrls())) URL.revokeObjectURL(url);
    this.thumbUrls.set({});
  }
}
