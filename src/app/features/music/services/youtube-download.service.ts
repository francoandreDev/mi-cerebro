// §19b — Descarga de MP3 desde YouTube. Sólo funciona en Tauri: yt-dlp
// (sidecar, ver §19a) hace la extracción, ffmpeg (sidecar, ver §19a-bis)
// hace la transcodificación a mp3 — yt-dlp lo spawnea directo vía
// `--ffmpeg-location`, la capa JS nunca invoca ffmpeg.
import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { tempDir } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/plugin-shell';
import { readFile, remove } from '@tauri-apps/plugin-fs';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { PlatformService } from '@core/platform/platform.service';

const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;

export interface YoutubeDownloadResult {
  readonly file: File;
  readonly title: string;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '').trim() || 'youtube-track';
}

@Injectable({ providedIn: 'root' })
export class YoutubeDownloadService {
  private readonly platform = inject(PlatformService);

  isAvailable(): boolean {
    return this.platform.current === 'tauri';
  }

  isValidUrl(url: string): boolean {
    return YOUTUBE_URL_RE.test(url.trim());
  }

  async download(url: string): Promise<YoutubeDownloadResult> {
    if (!this.isAvailable()) {
      throw new AppError(ERROR_CODES.MUS_002, { severity: 'warning', recoverable: true });
    }
    const trimmed = url.trim();
    if (!this.isValidUrl(trimmed)) {
      throw new AppError(ERROR_CODES.MUS_003, {
        severity: 'warning',
        context: { url: trimmed },
        recoverable: true,
      });
    }

    const ffmpegPath = await this.resolveFfmpegPath();
    const title = await this.fetchTitle(trimmed);

    const dir = await tempDir();
    const id = crypto.randomUUID();
    const outputTemplate = `${dir}mi-cerebro-yt-${id}.%(ext)s`;
    const expectedPath = `${dir}mi-cerebro-yt-${id}.mp3`;

    const result = await Command.sidecar('binaries/yt-dlp', [
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outputTemplate,
      trimmed,
    ]).execute();

    if (result.code !== 0) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        context: { url: trimmed, exitCode: result.code, stderr: result.stderr.slice(-2000) },
        recoverable: true,
      });
    }

    let bytes: Uint8Array;
    try {
      bytes = await readFile(expectedPath);
    } catch (cause) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        cause,
        context: { url: trimmed, expectedPath },
        recoverable: true,
      });
    }
    await remove(expectedPath).catch(() => undefined);

    const filename = `${sanitizeFilename(title)}.mp3`;
    const file = new File([bytes as BlobPart], filename, { type: 'audio/mpeg' });
    return { file, title };
  }

  private async resolveFfmpegPath(): Promise<string> {
    try {
      return await invoke<string>('sidecar_path', { name: 'ffmpeg' });
    } catch (cause) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        cause,
        context: { reason: 'ffmpeg-sidecar-not-found' },
        recoverable: true,
      });
    }
  }

  private async fetchTitle(url: string): Promise<string> {
    const result = await Command.sidecar('binaries/yt-dlp', [
      '--skip-download',
      '--print',
      '%(title)s',
      url,
    ]).execute();
    if (result.code !== 0) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        context: { url, exitCode: result.code, stderr: result.stderr.slice(-2000) },
        recoverable: true,
      });
    }
    return result.stdout.trim();
  }
}
