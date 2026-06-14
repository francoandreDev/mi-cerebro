import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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

@Component({
  selector: 'mc-music',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
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

  protected readonly picking = signal(false);
  protected readonly pickerQuery = signal('');

  protected readonly activeTracks = computed<readonly Track[]>(() => {
    const playlist = this.active();
    if (!playlist) return [];
    const byId = new Map(this.tracks().map((t) => [t.id, t] as const));
    return playlist.trackIds.map((id) => byId.get(id)).filter((t): t is Track => t !== undefined);
  });

  protected readonly availableForActive = computed<readonly Track[]>(() => {
    const playlist = this.active();
    if (!playlist) return [];
    const inUse = new Set(playlist.trackIds);
    return this.tracks().filter((t) => !inUse.has(t.id));
  });

  protected readonly pickerResults = computed<readonly Track[]>(() => {
    const q = this.pickerQuery().trim().toLowerCase();
    const all = this.availableForActive();
    if (q.length === 0) return all;
    return all.filter((t) => t.originalName.toLowerCase().includes(q));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected async onPickFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;
    try {
      await this.workspace.ensureWritable();
      await this.library.addTracks(files);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onDeleteTrack(track: Track): Promise<void> {
    if (!confirm(this.t('music.deleteTrackConfirm').replace('{name}', track.originalName))) return;
    try {
      await this.library.removeTrack(track.id);
      await this.playlists.removeTrackFromAll(track.id);
      const playlist = this.active();
      if (playlist?.trackIds.includes(track.id)) {
        this.active.set(await this.playlists.read(playlist.id));
      }
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onPlayTrack(track: Track): Promise<void> {
    await this.player.playTrack(track.id);
  }

  protected async onCreatePlaylist(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const created = await this.playlists.create(this.t('music.newPlaylistTitle'));
      this.openPlaylist(created);
    } catch (e) {
      this.errors.report(this.withReauth(e));
    }
  }

  protected async onSelectPlaylist(summary: PlaylistSummary): Promise<void> {
    try {
      this.openPlaylist(await this.playlists.read(summary.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onBackToList(): void {
    this.active.set(null);
    this.picking.set(false);
    this.pickerQuery.set('');
  }

  protected async onRenamePlaylist(title: string): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    const updated = await this.playlists.save({ ...playlist, title });
    this.active.set(updated);
  }

  protected async onDeletePlaylist(): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    if (!confirm(this.t('music.deletePlaylistConfirm').replace('{title}', playlist.title || '—')))
      return;
    await this.playlists.delete(playlist.id);
    this.onBackToList();
  }

  protected async onToggleFavorite(): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    const updated = await this.playlists.save({
      ...playlist,
      favorite: !(playlist.favorite === true),
    });
    this.active.set(updated);
  }

  protected togglePicker(): void {
    this.picking.update((v) => !v);
    if (!this.picking()) this.pickerQuery.set('');
  }

  protected async onAddToPlaylist(track: Track): Promise<void> {
    const playlist = this.active();
    if (!playlist || playlist.trackIds.includes(track.id)) return;
    const updated = await this.playlists.save({
      ...playlist,
      trackIds: [...playlist.trackIds, track.id],
    });
    this.active.set(updated);
  }

  protected async onRemoveFromPlaylist(trackId: string): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    const updated = await this.playlists.save({
      ...playlist,
      trackIds: playlist.trackIds.filter((id) => id !== trackId),
    });
    this.active.set(updated);
  }

  protected async onMove(trackId: string, delta: number): Promise<void> {
    const playlist = this.active();
    if (!playlist) return;
    const ids = [...playlist.trackIds];
    const idx = ids.indexOf(trackId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= ids.length) return;
    const a = ids[idx];
    const b = ids[target];
    if (a === undefined || b === undefined) return;
    ids[idx] = b;
    ids[target] = a;
    const updated = await this.playlists.save({ ...playlist, trackIds: ids });
    this.active.set(updated);
  }

  protected async onPlayPlaylist(): Promise<void> {
    const playlist = this.active();
    if (!playlist || playlist.trackIds.length === 0) return;
    await this.player.playPlaylist(playlist.trackIds, 0);
  }

  protected onTitleInput(value: string): void {
    void this.onRenamePlaylist(value);
  }

  protected onPickerQueryInput(value: string): void {
    this.pickerQuery.set(value);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  private openPlaylist(playlist: Playlist): void {
    this.active.set(playlist);
    this.picking.set(false);
    this.pickerQuery.set('');
  }

  private withReauth(e: unknown): unknown {
    return withReauthIfNeeded(e, () => this.workspace.reauthorize());
  }
}
