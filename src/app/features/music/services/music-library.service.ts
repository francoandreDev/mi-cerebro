import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';

import {
  COVERS_DIR,
  LIBRARY_FILE,
  MUSIC_DIR,
  MUSIC_LIBRARY_KIND,
  MUSIC_LIBRARY_SCHEMA_VERSION,
  TRACKS_DIR,
  TRACK_EXT,
  TRACK_MIME,
  type MusicLibrary,
  type Track,
} from '../models/music.types';
import { extFromMime, sha1Hex } from './cover-hash';
import { readId3, trackFieldsFromId3 } from './id3-reader';
import { musicLibraryV2MigrationStep } from './music-library.migration';

@Injectable({ providedIn: 'root' })
export class MusicLibraryService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);

  private readonly tracksSignal = signal<readonly Track[]>([]);
  readonly tracks = this.tracksSignal.asReadonly();

  constructor() {
    this.migrations.register({
      kind: MUSIC_LIBRARY_KIND,
      latest: MUSIC_LIBRARY_SCHEMA_VERSION,
      steps: [musicLibraryV2MigrationStep(1)],
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
      }
    }
    const backfilled = await this.backfillMetadata(root, lib.tracks);
    if (backfilled) lib = { schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION, tracks: backfilled };
    const sorted = [...lib.tracks].sort((a, b) => a.originalName.localeCompare(b.originalName));
    this.tracksSignal.set(sorted);
    return sorted;
  }

  // why: tracks imported before Fase 3 lack metadataProbedAt. Read ID3 lazily
  //      on refresh, write covers to disk, accumulate changes in-memory and
  //      flush the library JSON once at the end. Failures resolve to null so
  //      the loop keeps moving; the track stays unprobed and we retry next
  //      refresh.
  private async backfillMetadata(
    root: FsDirectoryHandle,
    tracks: readonly Track[],
  ): Promise<Track[] | null> {
    const pending = tracks.filter((t) => !t.metadataProbedAt);
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
    tracksDir: FsDirectoryHandle,
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
      return { ...track, ...trackFieldsFromId3(id3, coverPath), metadataProbedAt: now };
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
    return added;
  }

  async removeTrack(id: string): Promise<void> {
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    const filename = `${id}${TRACK_EXT}`;
    if (await this.fs.hasEntry(tracksDir, filename)) {
      await this.fs.removeEntry(tracksDir, filename);
    }
    const next: MusicLibrary = {
      schemaVersion: MUSIC_LIBRARY_SCHEMA_VERSION,
      tracks: this.tracksSignal().filter((t) => t.id !== id),
    };
    await this.writeLibrary(root, next);
    this.tracksSignal.set(next.tracks);
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

  private async musicDir(): Promise<FsDirectoryHandle> {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return this.fs.getOrCreateDir(root, MUSIC_DIR);
  }

  private async writeLibrary(dir: FsDirectoryHandle, lib: MusicLibrary): Promise<void> {
    await this.fs.writeFileAtomic(dir, LIBRARY_FILE, JSON.stringify(lib, null, 2));
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
