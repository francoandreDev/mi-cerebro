import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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

import type { Playlist, PlaylistSummary, Track } from '../models/music.types';
import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';
import { formatBytes, formatDuration, formatShortDate } from '../utils/music-format';

import { NowPlayingContainer } from './now-playing.container';
import { PlaylistEditorContainer } from './playlist-editor.container';
import { QueuePanelContainer } from './queue-panel.container';
import { registerMusicShortcuts } from './music.shortcuts';

export interface LibraryRow {
  readonly id: string;
  readonly originalName: string;
  readonly duration: string;
  readonly size: string;
  readonly added: string;
}

@Component({
  selector: 'mc-music',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PlaylistEditorContainer, NowPlayingContainer, QueuePanelContainer],
  templateUrl: './music.container.html',
  styleUrl: './music.container.css',
})
export class MusicContainer {
  private readonly library = inject(MusicLibraryService);
  private readonly playlists = inject(PlaylistsService);
  private readonly player = inject(PlayerService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tracks = this.library.tracks;
  protected readonly playlistSummaries = this.playlists.summaries;
  protected readonly active = signal<Playlist | null>(null);
  protected readonly currentTrackId = this.player.currentTrackId;
  protected readonly isPlaying = this.player.isPlaying;
  protected readonly currentSourceId = this.player.currentSourceId;

  protected readonly libraryQuery = signal('');
  protected readonly dragOver = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly railDropTargetId = signal<string | null>(null);
  private lastClickedId: string | null = null;

  private readonly libSearch = viewChild<ElementRef<HTMLInputElement>>('libSearch');

  constructor() {
    registerMusicShortcuts({
      togglePlay: () => void this.player.toggle(),
      newPlaylist: () => void this.onCreatePlaylist(),
      focusSearch: () => this.libSearch()?.nativeElement.focus(),
    });
  }

  protected readonly filteredTracks = computed<readonly Track[]>(() => {
    const q = this.libraryQuery().trim().toLowerCase();
    const all = this.tracks();
    if (q.length === 0) return all;
    return all.filter((t) => t.originalName.toLowerCase().includes(q));
  });

  protected readonly libraryRows = computed<readonly LibraryRow[]>(() => {
    const unknown = this.t('music.duration.unknown');
    return this.filteredTracks().map((t) => ({
      id: t.id,
      originalName: t.originalName,
      duration: formatDuration(t.durationMs ?? null) ?? unknown,
      size: formatBytes(t.bytes),
      added: formatShortDate(t.addedAt),
    }));
  });

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  protected readonly bulkCountLabel = computed(() =>
    this.t('music.bulk.selectedCount').replace('{n}', String(this.selectedCount())),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  protected onLibraryQueryInput(value: string): void {
    this.libraryQuery.set(value);
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
    //      to avoid flicker mid-drag.
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
    const ids = this.filteredTracks().map((t) => t.id);
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
      await this.refreshActiveIfTouched([t.id]);
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
      await this.refreshActiveIfTouched(ids);
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
      const updated = await this.playlists.save({ ...pl, trackIds: merged });
      if (this.active()?.id === updated.id) this.active.set(updated);
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

  protected onRailDragOver(playlistId: string, event: DragEvent): void {
    if (!event.dataTransfer || !hasTrackDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.railDropTargetId.set(playlistId);
  }

  protected onRailDragLeave(): void {
    this.railDropTargetId.set(null);
  }

  protected async onRailDrop(playlistId: string, event: DragEvent): Promise<void> {
    this.railDropTargetId.set(null);
    if (!hasTrackDrag(event)) return;
    event.preventDefault();
    const ids = parseTrackDragPayload(event);
    if (ids.length === 0) return;
    await this.mergeIntoPlaylist(playlistId, ids);
  }

  private async mergeIntoPlaylist(playlistId: string, ids: readonly string[]): Promise<void> {
    try {
      const pl = await this.playlists.read(playlistId);
      const merged = [...pl.trackIds];
      for (const id of ids) if (!merged.includes(id)) merged.push(id);
      const updated = await this.playlists.save({ ...pl, trackIds: merged });
      if (this.active()?.id === updated.id) this.active.set(updated);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onCreatePlaylist(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const created = await this.playlists.create(this.t('music.newPlaylistTitle'));
      this.active.set(created);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onSelectPlaylist(summary: PlaylistSummary): Promise<void> {
    try {
      this.active.set(await this.playlists.read(summary.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onEditorBack(): void {
    this.active.set(null);
  }

  protected onEditorChanged(playlist: Playlist): void {
    this.active.set(playlist);
  }

  protected onEditorDeleted(): void {
    this.active.set(null);
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

  private async refreshActiveIfTouched(removedIds: readonly string[]): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    if (!removedIds.some((id) => playlist.trackIds.includes(id))) return;
    try {
      this.active.set(await this.playlists.read(playlist.id));
    } catch {
      this.active.set(null);
    }
  }
}

const TRACK_DRAG_MIME = 'application/x-mc-track-ids';

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === 'Files') return true;
  return false;
}

function hasTrackDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === TRACK_DRAG_MIME) return true;
  return false;
}

function parseTrackDragPayload(event: DragEvent): readonly string[] {
  const raw = event.dataTransfer?.getData(TRACK_DRAG_MIME) ?? '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}
