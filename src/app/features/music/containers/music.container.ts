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
import { PlaylistsPanelContainer } from './playlists-panel.container';
import { QueuePanelContainer } from './queue-panel.container';
import { ResonantSurfaceContainer } from './resonant-surface.container';
import { registerMusicShortcuts } from './music.shortcuts';

type LeftView = 'albums' | 'playlists';

@Component({
  selector: 'mc-music',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    AlbumLibraryContainer,
    PlaylistEditorContainer,
    PlaylistsPanelContainer,
    NowPlayingContainer,
    QueuePanelContainer,
    ResonantSurfaceContainer,
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
  protected readonly leftView = signal<LeftView>('albums');

  private readonly albumLib = viewChild(AlbumLibraryContainer);

  constructor() {
    registerMusicShortcuts({
      togglePlay: () => void this.player.toggle(),
      newPlaylist: () => void this.onCreatePlaylist(),
      focusSearch: () => {
        this.leftView.set('albums');
        queueMicrotask(() => this.albumLib()?.focusSearch());
      },
      togglePlaylistsView: () =>
        this.leftView.update((v) => (v === 'playlists' ? 'albums' : 'playlists')),
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSelectLeftView(view: LeftView): void {
    this.leftView.set(view);
  }

  protected async onSelectPlaylistFromPanel(summary: PlaylistSummary): Promise<void> {
    try {
      this.active.set(await this.playlists.read(summary.id));
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
