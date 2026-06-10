import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  MUSIC_DIR,
  PLAYLISTS_DIR,
  PLAYLIST_FILE_SUFFIX,
  type Playlist,
  type PlaylistSummary,
} from '../models/music.types';

@Injectable({ providedIn: 'root' })
export class PlaylistsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly PlaylistSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  async refresh(): Promise<readonly PlaylistSummary[]> {
    const dir = await this.playlistsDir();
    this.idToFile.clear();
    const summaries: PlaylistSummary[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith(PLAYLIST_FILE_SUFFIX)) continue;
      try {
        const raw = await this.fs.readJson<Playlist>(dir, name);
        this.idToFile.set(raw.id, name);
        summaries.push(this.toSummary(raw));
      } catch (cause) {
        console.warn('[playlists] skipped unreadable file', name, cause);
      }
    }
    summaries.sort((a, b) => a.title.localeCompare(b.title));
    this.summariesSignal.set(summaries);
    return summaries;
  }

  async create(title = ''): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const now = new Date().toISOString();
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      title,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const filename = await this.allocFilename(dir, title);
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(playlist, null, 2));
    this.idToFile.set(playlist.id, filename);
    this.summariesSignal.update((curr) => sorted([this.toSummary(playlist), ...curr]));
    return playlist;
  }

  async read(id: string): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(id);
    return this.fs.readJson<Playlist>(dir, filename);
  }

  async save(playlist: Playlist): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(playlist.id);
    const updated: Playlist = { ...playlist, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sorted(curr.map((s) => (s.id === playlist.id ? this.toSummary(updated) : s))),
    );
    return updated;
  }

  async delete(id: string): Promise<void> {
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(id);
    await this.fs.removeEntry(dir, filename);
    this.idToFile.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
  }

  async removeTrackFromAll(trackId: string): Promise<void> {
    for (const summary of [...this.summariesSignal()]) {
      const pl = await this.read(summary.id);
      if (!pl.trackIds.includes(trackId)) continue;
      await this.save({ ...pl, trackIds: pl.trackIds.filter((t) => t !== trackId) });
    }
  }

  private requireFilename(id: string): string {
    const f = this.idToFile.get(id);
    if (!f) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    return f;
  }

  private async playlistsDir(): Promise<FsDirectoryHandle> {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const music = await this.fs.getOrCreateDir(root, MUSIC_DIR);
    return this.fs.getOrCreateDir(music, PLAYLISTS_DIR);
  }

  private async allocFilename(dir: FsDirectoryHandle, title: string): Promise<string> {
    const base = toSlug(title || 'playlist');
    for (let n = 1; n < 1000; n++) {
      const candidate = `${withSuffix(base, n)}${PLAYLIST_FILE_SUFFIX}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private toSummary(p: Playlist): PlaylistSummary {
    return {
      id: p.id,
      title: p.title,
      trackCount: p.trackIds.length,
      updatedAt: p.updatedAt,
      favorite: p.favorite === true,
    };
  }
}

const sorted = (list: readonly PlaylistSummary[]): readonly PlaylistSummary[] =>
  [...list].sort((a, b) => a.title.localeCompare(b.title));
