import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import type { PlaylistSummary, Track } from '../models/music.types';
import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';
import { YoutubeDownloadService } from '../services/youtube-download.service';
import { groupTracksByAlbum } from '../utils/album-grouping';
import { formatDuration } from '../utils/music-format';
import { TRACK_DRAG_MIME, hasFiles } from './music.dnd';

@Component({
  selector: 'mc-album-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './album-library.container.html',
  styleUrl: './album-library.container.css',
})
export class AlbumLibraryContainer {
  private readonly library = inject(MusicLibraryService);
  private readonly playlists = inject(PlaylistsService);
  private readonly player = inject(PlayerService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly youtube = inject(YoutubeDownloadService);

  readonly playlistSummaries = input.required<readonly PlaylistSummary[]>();
  readonly tracksTouched = output<readonly string[]>();

  protected readonly tracks = this.library.tracks;
  protected readonly currentTrackId = this.player.currentTrackId;
  protected readonly isPlaying = this.player.isPlaying;

  protected readonly query = signal('');
  protected readonly dragOver = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  private lastClickedId: string | null = null;

  protected readonly youtubeAvailable = this.youtube.isAvailable();
  protected readonly youtubeUrl = signal('');
  protected readonly youtubeDownloading = signal(false);

  private readonly libSearch = viewChild<ElementRef<HTMLInputElement>>('libSearch');

  protected readonly filteredTracks = computed<readonly Track[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.tracks();
    if (q.length === 0) return all;
    return all.filter(
      (t) =>
        t.originalName.toLowerCase().includes(q) ||
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.album ?? '').toLowerCase().includes(q) ||
        (t.artist ?? '').toLowerCase().includes(q) ||
        (t.albumArtist ?? '').toLowerCase().includes(q),
    );
  });

  protected readonly albumGroups = computed(() => groupTracksByAlbum(this.filteredTracks()));
  protected readonly selectedCount = computed(() => this.selectedIds().size);

  protected readonly bulkCountLabel = computed(() =>
    this.t('music.bulk.selectedCount').replace('{n}', String(this.selectedCount())),
  );

  focusSearch(): void {
    this.libSearch()?.nativeElement.focus();
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  protected formatDurationMs(ms: number | null | undefined): string {
    return formatDuration(ms ?? null) ?? this.t('music.duration.unknown');
  }

  protected groupCountLabel(n: number): string {
    return n === 1
      ? this.t('music.album.tracksCountOne')
      : this.t('music.album.tracksCount').replace('{n}', String(n));
  }

  protected onQueryInput(value: string): void {
    this.query.set(value);
  }

  protected async onPickFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    await this.addFilesToLibrary(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    // why: dragleave fires for every child boundary; gate on no-related-target
    if (event.relatedTarget === null) this.dragOver.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    await this.addFilesToLibrary(files);
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected onToggleSelect(id: string, event: MouseEvent): void {
    const ids = this.filteredTracks().map((t) => t.id);
    const next = new Set(this.selectedIds());
    if (event.shiftKey && this.lastClickedId !== null) {
      const a = ids.indexOf(this.lastClickedId);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) {
          const rowId = ids[i];
          if (rowId !== undefined) next.add(rowId);
        }
      }
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.lastClickedId = id;
    this.selectedIds.set(next);
  }

  protected onClearSelection(): void {
    this.selectedIds.set(new Set());
    this.lastClickedId = null;
  }

  protected async onPlayRow(id: string): Promise<void> {
    if (this.currentTrackId() === id) {
      await this.player.toggle();
      return;
    }
    // why: play queue = filtered + grouped order so the next/prev follow
    //      what the user sees on screen.
    const ids = this.albumGroups().flatMap((g) => g.tracks.map((t) => t.id));
    const startIndex = ids.indexOf(id);
    if (startIndex < 0) return;
    await this.player.playPlaylist(ids, startIndex, null);
  }

  protected async onDeleteRow(id: string): Promise<void> {
    const t = this.tracks().find((x) => x.id === id);
    if (!t) return;
    if (!confirm(this.t('music.deleteTrackConfirm').replace('{name}', t.originalName))) return;
    try {
      await this.library.removeTrack(t.id);
      await this.playlists.removeTrackFromAll(t.id);
      this.tracksTouched.emit([t.id]);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onBulkDelete(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    if (!confirm(this.t('music.bulk.confirmDelete').replace('{n}', String(ids.length)))) return;
    try {
      for (const id of ids) {
        await this.library.removeTrack(id);
        await this.playlists.removeTrackFromAll(id);
      }
      this.tracksTouched.emit(ids);
      this.onClearSelection();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onBulkAddToPlaylist(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const playlistId = select.value;
    select.value = '';
    if (playlistId === '') return;
    const trackIds = [...this.selectedIds()];
    if (trackIds.length === 0) return;
    try {
      const pl = await this.playlists.read(playlistId);
      const merged = [...pl.trackIds];
      for (const id of trackIds) if (!merged.includes(id)) merged.push(id);
      await this.playlists.save({ ...pl, trackIds: merged });
      this.tracksTouched.emit([]);
      this.onClearSelection();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onRowDragStart(id: string, event: DragEvent): void {
    if (!event.dataTransfer) return;
    const ids = this.isSelected(id) ? [...this.selectedIds()] : [id];
    event.dataTransfer.setData(TRACK_DRAG_MIME, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = 'copy';
  }

  protected onYoutubeUrlInput(value: string): void {
    this.youtubeUrl.set(value);
  }

  protected async onYoutubeDownload(): Promise<void> {
    const url = this.youtubeUrl().trim();
    if (url === '' || this.youtubeDownloading()) return;
    this.youtubeDownloading.set(true);
    try {
      const { file } = await this.youtube.download(url);
      await this.workspace.ensureWritable();
      await this.library.addTracks([file]);
      this.youtubeUrl.set('');
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.youtubeDownloading.set(false);
    }
  }

  private async addFilesToLibrary(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    try {
      await this.workspace.ensureWritable();
      await this.library.addTracks(files);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
}
