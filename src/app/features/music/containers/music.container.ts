import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import type { Playlist, PlaylistSummary } from '../models/music.types';
import { PlaylistsService } from '../services/playlists.service';

import { AlbumLibraryContainer } from './album-library.container';
import { NowPlayingContainer } from './now-playing.container';
import { PlaylistEditorContainer } from './playlist-editor.container';
import { QueuePanelContainer } from './queue-panel.container';
import { hasTrackDrag, parseTrackDragPayload } from './music.dnd';
import { registerMusicShortcuts } from './music.shortcuts';

@Component({
  selector: 'mc-music',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    AlbumLibraryContainer,
    PlaylistEditorContainer,
    NowPlayingContainer,
    QueuePanelContainer,
  ],
  templateUrl: './music.container.html',
  styleUrl: './music.container.css',
})
export class MusicContainer {
  private readonly playlists = inject(PlaylistsService);
  private readonly player = inject(PlayerService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly playlistSummaries = this.playlists.summaries;
  protected readonly active = signal<Playlist | null>(null);
  protected readonly currentSourceId = this.player.currentSourceId;

  protected readonly railDropTargetId = signal<string | null>(null);

  private readonly albumLib = viewChild(AlbumLibraryContainer);

  constructor() {
    registerMusicShortcuts({
      togglePlay: () => void this.player.toggle(),
      newPlaylist: () => void this.onCreatePlaylist(),
      focusSearch: () => this.albumLib()?.focusSearch(),
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
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

  protected async onTracksTouched(removedIds: readonly string[]): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    if (removedIds.length > 0 && !removedIds.some((id) => playlist.trackIds.includes(id))) return;
    try {
      this.active.set(await this.playlists.read(playlist.id));
    } catch {
      this.active.set(null);
    }
  }
}
