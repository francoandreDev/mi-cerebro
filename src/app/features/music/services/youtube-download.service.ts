// §19b — Descarga de MP3 desde YouTube. En Tauri, yt-dlp (sidecar, ver §19a)
// hace la extracción y ffmpeg (sidecar, ver §19a-bis) la transcodificación a
// mp3 — yt-dlp lo spawnea directo vía `--ffmpeg-location`, la capa JS nunca
// invoca ffmpeg. En Capacitor (addendum 2026-07-18) no hay spawn de procesos
// arbitrarios permitido por el sandbox de Android, así que la misma pareja
// yt-dlp+ffmpeg se resuelve como librería nativa embebida (youtubedl-android)
// detrás de un plugin Capacitor propio — ver YoutubeDlPlugin.java y
// youtube-download-native.plugin.ts. Sin equivalente en browser ni iOS.
import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { join, tempDir } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/plugin-shell';
import { readFile, remove } from '@tauri-apps/plugin-fs';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { PlatformService } from '@core/platform/platform.service';

import { YoutubeDlNative } from './youtube-download-native.plugin';

const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;

// why: YouTube's newer signature-cipher challenge needs a JS runtime
//      (deno) that yt-dlp can shell out to — without one, extraction
//      returns "HTTP Error 403: Forbidden" for the default (web) client.
//      Forcing the android client sidesteps the JS challenge entirely
//      (that client's URLs aren't signature-ciphered), avoiding the need
//      to bundle a third sidecar just for this. Verified against a real
//      video end-to-end (title fetch + full download + mp3 conversion).
const YOUTUBE_EXTRACTOR_ARGS = ['--extractor-args', 'youtube:player_client=android'];

export interface YoutubeDownloadResult {
  readonly file: File;
  readonly title: string;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '').trim() || 'youtube-track';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

@Injectable({ providedIn: 'root' })
export class YoutubeDownloadService {
  private readonly platform = inject(PlatformService);

  isAvailable(): boolean {
    return this.platform.current === 'tauri' || this.platform.current === 'capacitor';
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

    const title = await this.fetchTitle(trimmed);
    const bytes =
      this.platform.current === 'tauri'
        ? await this.downloadTauri(trimmed)
        : await this.downloadCapacitor(trimmed);

    const filename = `${sanitizeFilename(title)}.mp3`;
    const file = new File([bytes as BlobPart], filename, { type: 'audio/mpeg' });
    return { file, title };
  }

  private async downloadTauri(url: string): Promise<Uint8Array> {
    const ffmpegPath = await this.resolveFfmpegPath();

    const dir = await tempDir();
    const id = crypto.randomUUID();
    const outputTemplate = await join(dir, `mi-cerebro-yt-${id}.%(ext)s`);
    const expectedPath = await join(dir, `mi-cerebro-yt-${id}.mp3`);

    const args = [
      ...YOUTUBE_EXTRACTOR_ARGS,
      // why: sin forzar el stream, el "SABR-only streaming experiment" de
      //      YouTube (github.com/yt-dlp/yt-dlp/issues/12482) puede dejar
      //      al cliente android sin streams de solo-audio con URL usable,
      //      y yt-dlp cae al formato muxeado 18 (video+audio, cientos de
      //      MB) — la extraccion de audio termina re-codificando un video
      //      entero. "bestaudio/best" evita ese fallback.
      '-f',
      'bestaudio/best',
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outputTemplate,
      url,
    ];
    const result = await Command.sidecar('binaries/yt-dlp', args).execute();

    if (result.code !== 0) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        context: {
          url,
          exitCode: result.code,
          args,
          stdout: result.stdout,
          stderr: result.stderr,
        },
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
        context: { url, expectedPath },
        recoverable: true,
      });
    }
    await remove(expectedPath).catch(() => undefined);
    return bytes;
  }

  private async downloadCapacitor(url: string): Promise<Uint8Array> {
    try {
      const { base64 } = await YoutubeDlNative.download({ url });
      return base64ToBytes(base64);
    } catch (cause) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        cause,
        context: { url, reason: 'capacitor-native-download-failed' },
        recoverable: true,
      });
    }
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
    return this.platform.current === 'tauri'
      ? this.fetchTitleTauri(url)
      : this.fetchTitleCapacitor(url);
  }

  private async fetchTitleTauri(url: string): Promise<string> {
    const result = await Command.sidecar('binaries/yt-dlp', [
      ...YOUTUBE_EXTRACTOR_ARGS,
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

  private async fetchTitleCapacitor(url: string): Promise<string> {
    try {
      const { title } = await YoutubeDlNative.fetchTitle({ url });
      return title;
    } catch (cause) {
      throw new AppError(ERROR_CODES.MUS_004, {
        severity: 'error',
        cause,
        context: { url, reason: 'capacitor-native-fetch-title-failed' },
        recoverable: true,
      });
    }
  }
}
