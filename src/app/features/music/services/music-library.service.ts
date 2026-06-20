import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import {
  LIBRARY_FILE,
  MUSIC_DIR,
  TRACKS_DIR,
  TRACK_EXT,
  TRACK_MIME,
  type MusicLibrary,
  type Track,
} from '../models/music.types';

@Injectable({ providedIn: 'root' })
export class MusicLibraryService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);

  private readonly tracksSignal = signal<readonly Track[]>([]);
  readonly tracks = this.tracksSignal.asReadonly();

  async refresh(): Promise<readonly Track[]> {
    const root = await this.musicDir();
    let lib: MusicLibrary = { tracks: [] };
    if (await this.fs.hasEntry(root, LIBRARY_FILE)) {
      try {
        lib = await this.fs.readJson<MusicLibrary>(root, LIBRARY_FILE);
      } catch (cause) {
        console.warn('[music] library file unreadable', cause);
      }
    }
    const sorted = [...lib.tracks].sort((a, b) => a.originalName.localeCompare(b.originalName));
    this.tracksSignal.set(sorted);
    return sorted;
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
      added.push({
        id,
        originalName: file.name,
        addedAt: now,
        bytes: file.size,
        durationMs,
      });
    }
    if (added.length === 0) return [];
    const next: MusicLibrary = { tracks: [...this.tracksSignal(), ...added] };
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
    const next: MusicLibrary = { tracks: this.tracksSignal().filter((t) => t.id !== id) };
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
    await this.writeLibrary(root, { tracks: next });
  }

  async readBlob(id: string): Promise<Blob> {
    const root = await this.musicDir();
    const tracksDir = await this.fs.getOrCreateDir(root, TRACKS_DIR);
    return this.fs.readFile(tracksDir, `${id}${TRACK_EXT}`);
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
    await this.writeLibrary(root, { tracks: next });
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
