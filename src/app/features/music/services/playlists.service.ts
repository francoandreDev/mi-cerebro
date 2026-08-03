import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  MUSIC_DIR,
  PLAYLISTS_DIR,
  PLAYLIST_FILE_SUFFIX,
  PLAYLIST_KIND,
  PLAYLIST_SCHEMA_VERSION,
  type Playlist,
  type PlaylistSummary,
} from '../models/music.types';
import { playlistV2MigrationStep } from './playlist.migration';

const TRASH_META_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class PlaylistsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly errors = inject(ErrorService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly PlaylistSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  constructor() {
    this.migrations.register({
      kind: PLAYLIST_KIND,
      latest: PLAYLIST_SCHEMA_VERSION,
      steps: [playlistV2MigrationStep(1)],
    });
  }

  async refresh(): Promise<readonly PlaylistSummary[]> {
    const dir = await this.playlistsDir();
    this.idToFile.clear();
    const summaries: PlaylistSummary[] = [];
    const docs: SearchDoc[] = [];
    let skipped = 0;
    for await (const name of this.fs.listFiles(dir, PLAYLIST_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Playlist>(dir, name);
        const playlist = await this.migrate(raw);
        this.idToFile.set(playlist.id, name);
        summaries.push(this.toSummary(playlist));
        docs.push(this.toSearchDoc(playlist));
      } catch (cause) {
        skipped++;
        console.warn('[playlists] skipped unreadable file', name, cause);
      }
    }
    this.errors.reportSkippedEntries(skipped, { area: 'playlists' });
    summaries.sort((a, b) => a.title.localeCompare(b.title));
    this.summariesSignal.set(summaries);
    await this.search.rebuildKind(PLAYLIST_KIND, docs);
    return summaries;
  }

  async create(title = ''): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const now = new Date().toISOString();
    const playlist: Playlist = {
      schemaVersion: PLAYLIST_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      title,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
      tags: [],
    };
    const filename = await this.allocFilename(dir, title);
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(playlist, null, 2));
    this.idToFile.set(playlist.id, filename);
    this.summariesSignal.update((curr) => sorted([this.toSummary(playlist), ...curr]));
    await this.search.upsert(this.toSearchDoc(playlist));
    return playlist;
  }

  async read(id: string): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(id);
    const raw = await this.fs.readJson<Playlist>(dir, filename);
    return this.migrate(raw);
  }

  async save(playlist: Playlist): Promise<Playlist> {
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(playlist.id);
    const updated: Playlist = { ...playlist, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sorted(curr.map((s) => (s.id === playlist.id ? this.toSummary(updated) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.playlistsDir();
    const filename = this.requireFilename(id);
    const trash = await this.trashDir(root);
    const dest = `${PLAYLIST_KIND}__${id}__${filename}`;
    await this.fs.moveFile(dir, filename, trash, dest);
    this.idToFile.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async restoreFromTrash(trashDayDir: NativeDirRef, filename: string): Promise<void> {
    const dir = await this.playlistsDir();
    const original = filename.replace(new RegExp(`^${PLAYLIST_KIND}__[^_]+__`), '');
    const dest = await this.allocAvailable(dir, original);
    await this.fs.moveFile(trashDayDir, filename, dir, dest);
    await this.refresh();
  }

  async addTracks(id: string, trackIds: readonly string[]): Promise<Playlist> {
    const pl = await this.read(id);
    const merged = [...pl.trackIds];
    for (const trackId of trackIds) if (!merged.includes(trackId)) merged.push(trackId);
    return this.save({ ...pl, trackIds: merged });
  }

  async removeTrackFromAll(trackId: string): Promise<void> {
    for (const summary of [...this.summariesSignal()]) {
      const pl = await this.read(summary.id);
      if (!pl.trackIds.includes(trackId)) continue;
      await this.save({ ...pl, trackIds: pl.trackIds.filter((t) => t !== trackId) });
    }
  }

  private async migrate(raw: Playlist): Promise<Playlist> {
    // why: playlists predate `schemaVersion` entirely — legacy files have no
    //      such field, so assume v1 to run the chain (same seeding pattern
    //      as MusicLibraryService.refresh).
    const seeded: Playlist = { ...raw, schemaVersion: raw.schemaVersion ?? 1 };
    return this.migrations.migrate<Playlist>(PLAYLIST_KIND, seeded);
  }

  private requireFilename(id: string): string {
    const f = this.idToFile.get(id);
    if (!f) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    return f;
  }

  private async playlistsDir(): Promise<NativeDirRef> {
    const root = this.requireRoot();
    const music = await this.fs.getOrCreateDir(root, MUSIC_DIR);
    return this.fs.getOrCreateDir(music, PLAYLISTS_DIR);
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async trashDir(root: NativeDirRef): Promise<NativeDirRef> {
    const meta = await this.fs.getOrCreateDir(root, TRASH_META_DIR);
    const trash = await this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    let cursor = trash;
    for (const part of today.split('/')) {
      cursor = await this.fs.getOrCreateDir(cursor, part);
    }
    return cursor;
  }

  private async allocAvailable(dir: NativeDirRef, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    const dot = name.lastIndexOf('.');
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    for (let n = 1; n < 1000; n++) {
      const candidate = `${base}-${n}${ext}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private async allocFilename(dir: NativeDirRef, title: string): Promise<string> {
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
      tags: p.tags,
    };
  }

  private toSearchDoc(p: Playlist): SearchDoc {
    const tagIds = p.tags.filter((id) => this.tags.byId(id) !== undefined);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    return {
      id: p.id,
      kind: PLAYLIST_KIND,
      title: p.title,
      body: tagLabels,
      tagIds,
    };
  }
}

const sorted = (list: readonly PlaylistSummary[]): readonly PlaylistSummary[] =>
  [...list].sort((a, b) => a.title.localeCompare(b.title));
