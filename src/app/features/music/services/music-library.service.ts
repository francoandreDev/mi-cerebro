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
import { toSlug } from '@shared/utils/slug';

import {
  COVERS_DIR,
  LIBRARY_FILE,
  MUSIC_DIR,
  MUSIC_LIBRARY_KIND,
  MUSIC_LIBRARY_SCHEMA_VERSION,
  MUSIC_METADATA_PROBE_VERSION,
  TRACKS_DIR,
  TRACK_EXT,
  TRACK_KIND,
  TRACK_META_FILE,
  TRACK_MIME,
  type MusicLibrary,
  type Track,
} from '../models/music.types';
import { extFromMime, sha1Hex } from './cover-hash';
import { readId3, trackFieldsFromId3 } from './id3-reader';
import {
  musicLibraryV2MigrationStep,
  musicLibraryV3MigrationStep,
} from './music-library.migration';

const TRASH_META_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class MusicLibraryService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly errors = inject(ErrorService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly tracksSignal = signal<readonly Track[]>([]);
  readonly tracks = this.tracksSignal.asReadonly();

  constructor() {
    this.migrations.register({
      kind: MUSIC_LIBRARY_KIND,
      latest: MUSIC_LIBRARY_SCHEMA_VERSION,
      steps: [musicLibraryV2MigrationStep(1), musicLibraryV3MigrationStep(2)],
    });
  }

  async refresh(): Promise<readonly Track[]> {
    const root = await this.musicDir();
    let lib: MusicLibrary = emptyLibrary();
    if (await this.fs.hasEntry(root, LIBRARY_FILE)) {
      try {
        const raw = await this.fs.readJson<MusicLibrary>(root, LIBRARY_FILE);
        // why: legacy library files predate schemaVersion (v1); assume v1 so
        //      the migration chain runs and bumps them to current.
        const seeded: MusicLibrary = { ...raw, schemaVersion: raw.schemaVersion ?? 1 };
        lib = await this.migrations.migrate<MusicLibrary>(MUSIC_LIBRARY_KIND, seeded);
      } catch (cause) {
        console.warn('[music] library file unreadable', cause);
        // why: unlike per-entry scan skips elsewhere, this is a single
        //      critical file — if it's corrupt the whole library shows
        //      empty, so report it immediately instead of via the
        //      aggregated skipped-entries count (rule 28: no silent fail).
        this.errors.report(
          new AppError(ERROR_CODES.ENT_001, { severity: 'warning', context: { area: 'music' } }),
        );
      }
    }
    const backfilled = await this.backfillMetadata(root, lib.tracks);
    if (backfilled) lib = { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: backfilled };
    const sorted = [...lib.tracks].sort((a, b) => a.originalName.localeCompare(b.originalName));
    this.tracksSignal.set(sorted);
    await this.search.rebuildKind(TRACK_KIND, sorted.map((t) => this.toSearchDoc(t)));
    return sorted;
  }

  // why: tracks imported before Fase 3 lack metadataProbedAt. Read ID3 lazily
  //      on refresh, write covers to disk, accumulate changes in-memory and
  //      flush the library JSON once at the end. Failures resolve to null so
  //      the loop keeps moving; the track stays unprobed and we retry next
  //      refresh.
  private async backfillMetadata(
    root: NativeDirRef,
    tracks: readonly Track[],
  ): Promise<Track[] | null> {
    const pending = tracks.filter(
      (t) => !t.metadataProbedAt || (t.metadataProbeVersion ?? 1) < MUSIC_METADATA_PROBE_VERSION,
    );
    if (pending.length === 0) return null;
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    const now = new Date().toISOString();
    const updates = new Map<string, Track>();
    for (const track of pending) {
      const probed = await this.probeTrackFromDisk(tracksDir, track, now);
      if (probed) updates.set(track.id, probed);
    }
    if (updates.size === 0) return null;
    const next = tracks.map((t) => updates.get(t.id) ?? t);
    await this.writeLibrary(root, { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: next });
    return next;
  }

  private async probeTrackFromDisk(
    tracksDir: NativeDirRef,
    track: Track,
    now: string,
  ): Promise<Track | null> {
    const filename = `${track.id}${TRACK_EXT}`;
    if (!(await this.fs.hasEntry(tracksDir, filename))) return null;
    try {
      const blob = await this.fs.readFile(tracksDir, filename);
      const id3 = await readId3(blob);
      const coverPath = id3?.picture
        ? await this.storeCover(id3.picture.blob, id3.picture.mime)
        : null;
      return {
        ...track,
        ...trackFieldsFromId3(id3, coverPath),
        metadataProbedAt: now,
        metadataProbeVersion: MUSIC_METADATA_PROBE_VERSION,
      };
    } catch (cause) {
      console.warn('[music] backfill failed', track.id, cause);
      return null;
    }
  }

  async addTracks(files: readonly File[]): Promise<readonly Track[]> {
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    const now = new Date().toISOString();
    const added: Track[] = [];
    for (const file of files) {
      if (!isMp3(file)) {
        console.warn('[music] skipped non-mp3', file.name, file.type);
        continue;
      }
      const id = crypto.randomUUID();
      const filename = `${id}${TRACK_EXT}`;
      await this.fs.writeFileAtomicBinary(tracksDir, filename, file);
      const durationMs = await probeDurationMs(file);
      const id3 = await readId3(file);
      const coverPath = id3?.picture
        ? await this.storeCover(id3.picture.blob, id3.picture.mime)
        : null;
      added.push({
        id,
        originalName: file.name,
        addedAt: now,
        bytes: file.size,
        durationMs,
        ...trackFieldsFromId3(id3, coverPath),
        metadataProbedAt: now,
        metadataProbeVersion: MUSIC_METADATA_PROBE_VERSION,
        tags: [],
      });
    }
    if (added.length === 0) return [];
    const next: MusicLibrary = {
      schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION,
      tracks: [...this.tracksSignal(), ...added],
    };
    await this.writeLibrary(root, next);
    const sorted = [...next.tracks].sort((a, b) => a.originalName.localeCompare(b.originalName));
    this.tracksSignal.set(sorted);
    for (const t of added) await this.search.upsert(this.toSearchDoc(t));
    return added;
  }

  async setTrackTags(id: string, tags: readonly string[]): Promise<void> {
    const current = this.tracksSignal();
    const idx = current.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const updated: Track = { ...current[idx]!, tags };
    const next = [...current];
    next[idx] = updated;
    this.tracksSignal.set(next);
    const root = await this.musicDir();
    await this.writeLibrary(root, { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: next });
    await this.search.upsert(this.toSearchDoc(updated));
  }

  async removeTrackToTrash(id: string): Promise<void> {
    const track = this.tracksSignal().find((t) => t.id === id);
    if (!track) return;
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    const wsRoot = this.requireRoot();
    const trash = await this.trashDir(wsRoot);
    const slug = toSlug(track.title || track.originalName || 'track');
    const destDir = await this.fs.getOrCreateDir(trash, `${TRACK_KIND}__${id}__${slug}`);
    await this.fs.writeFileAtomic(destDir, TRACK_META_FILE, JSON.stringify(track, null, 2));
    const filename = `${id}${TRACK_EXT}`;
    if (await this.fs.hasEntry(tracksDir, filename)) {
      await this.fs.moveFile(tracksDir, filename, destDir, filename);
    }
    const next: MusicLibrary = {
      schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION,
      tracks: this.tracksSignal().filter((t) => t.id !== id),
    };
    await this.writeLibrary(root, next);
    this.tracksSignal.set(next.tracks);
    await this.search.remove(id);
  }

  async restoreTrackFromTrash(trashDayDir: NativeDirRef, entryName: string): Promise<void> {
    const srcDir = await this.fs.getDir(trashDayDir, entryName);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const raw = await this.fs.readJson<Track>(srcDir, TRACK_META_FILE);
    // why: tracks trashed before tags existed lack the field entirely — the
    //      trashed meta.json is a raw snapshot, not migrated on read.
    const track: Track = { ...raw, tags: Array.isArray(raw.tags) ? raw.tags : [] };
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    const filename = `${track.id}${TRACK_EXT}`;
    if (await this.fs.hasEntry(srcDir, filename)) {
      await this.fs.moveFile(srcDir, filename, tracksDir, filename);
    }
    const next: MusicLibrary = {
      schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION,
      tracks: [...this.tracksSignal(), track],
    };
    await this.writeLibrary(root, next);
    const sorted = [...next.tracks].sort((a, b) => a.originalName.localeCompare(b.originalName));
    this.tracksSignal.set(sorted);
    await this.search.upsert(this.toSearchDoc(track));
    try {
      await this.fs.removeEntry(trashDayDir, entryName, { recursive: true });
    } catch {
      /* already gone */
    }
  }

  async backfillDurationMs(id: string, durationMs: number): Promise<void> {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const current = this.tracksSignal();
    const idx = current.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const track = current[idx]!;
    if (track.durationMs !== null && track.durationMs > 0) return;
    const updated: Track = { ...track, durationMs: Math.round(durationMs) };
    const next = [...current];
    next[idx] = updated;
    this.tracksSignal.set(next);
    const root = await this.musicDir();
    await this.writeLibrary(root, { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: next });
  }

  async readBlob(id: string): Promise<Blob> {
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    return this.fs.readFile(tracksDir, `${id}${TRACK_EXT}`);
  }

  // why: covers are content-addressed in `music/covers/<sha1>.<ext>` so two
  //      tracks of the same album share one file. Returns the relative path
  //      stored on Track.coverPath, or null if the mime is unsupported.
  async storeCover(blob: Blob, mime: string): Promise<string | null> {
    const ext = extFromMime(mime);
    if (!ext) return null;
    const hash = await sha1Hex(blob);
    const filename = `${hash}.${ext}`;
    const root = await this.musicDir();
    const coversDir = await this.fs.getOrCreateDir(root, COVERS_DIR);
    if (!(await this.fs.hasEntry(coversDir, filename))) {
      await this.fs.writeFileAtomicBinary(coversDir, filename, blob);
    }
    return `${COVERS_DIR}/${filename}`;
  }

  async readCoverBlob(coverPath: string): Promise<Blob | null> {
    const [dir, filename] = coverPath.split('/', 2);
    if (dir !== COVERS_DIR || !filename) return null;
    const root = await this.musicDir();
    const coversDir = await this.fs.getOrCreateDir(root, COVERS_DIR);
    if (!(await this.fs.hasEntry(coversDir, filename))) return null;
    try {
      return await this.fs.readFile(coversDir, filename);
    } catch {
      return null;
    }
  }

  byId(id: string): Track | null {
    return this.tracksSignal().find((t) => t.id === id) ?? null;
  }

  async incrementPlayCount(id: string): Promise<void> {
    const current = this.tracksSignal();
    const idx = current.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const track = current[idx]!;
    const updated: Track = {
      ...track,
      playCount: (track.playCount ?? 0) + 1,
      lastPlayedAt: new Date().toISOString(),
    };
    const next = [...current];
    next[idx] = updated;
    this.tracksSignal.set(next);
    const root = await this.musicDir();
    await this.writeLibrary(root, { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: next });
  }

  private async musicDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), MUSIC_DIR);
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

  private async writeLibrary(dir: NativeDirRef, lib: MusicLibrary): Promise<void> {
    await this.fs.writeFileAtomic(dir, LIBRARY_FILE, JSON.stringify(lib, null, 2));
  }

  private toSearchDoc(track: Track): SearchDoc {
    const tagIds = track.tags.filter((id) => this.tags.byId(id) !== undefined);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = [track.artist, track.album, track.genre].filter(Boolean).join(' ');
    return {
      id: track.id,
      kind: TRACK_KIND,
      title: track.title?.trim() || track.originalName,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }
}

const emptyLibrary = (): MusicLibrary => ({
  schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION,
  tracks: [],
});

const isMp3 = (file: File): boolean =>
  file.type === TRACK_MIME || file.name.toLowerCase().endsWith(TRACK_EXT);

const probeDurationMs = (file: Blob): Promise<number | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const done = (value: number | null): void => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.addEventListener('loadedmetadata', () => {
      const sec = audio.duration;
      done(Number.isFinite(sec) && sec > 0 ? Math.round(sec * 1000) : null);
    });
    audio.addEventListener('error', () => done(null));
    audio.src = url;
  });
