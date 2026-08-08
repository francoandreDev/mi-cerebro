import { Injectable, computed, inject, signal } from '@angular/core';
import { zip, type Zippable } from 'fflate';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { OpfsGitRootService } from '@core/versioning/opfs-git-root';

import { buildZipFilename, shouldIncludeEntry } from './export-zip';
import type { ExportOptions, ExportProgress } from './export-zip.types';

@Injectable({ providedIn: 'root' })
export class ExportZipService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);

  private readonly progressSignal = signal<ExportProgress>({ phase: 'idle', count: 0, total: 0 });
  readonly progress = this.progressSignal.asReadonly();
  readonly isRunning = computed(() => {
    const p = this.progressSignal().phase;
    return p === 'walking' || p === 'compressing';
  });

  async exportToDownload(opts: ExportOptions): Promise<void> {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.EXP_003, { severity: 'error' });
    try {
      this.progressSignal.set({ phase: 'walking', count: 0, total: 0 });
      const tree = await this.collect(root, opts);
      this.progressSignal.set({
        phase: 'compressing',
        count: Object.keys(tree).length,
        total: Object.keys(tree).length,
      });
      const data = await zipAsync(tree);
      triggerDownload(data, buildZipFilename(root.name, new Date()));
      this.progressSignal.set({
        phase: 'done',
        count: Object.keys(tree).length,
        total: Object.keys(tree).length,
      });
    } catch (cause) {
      this.progressSignal.set({ phase: 'idle', count: 0, total: 0 });
      if (cause instanceof AppError) throw cause;
      throw new AppError(ERROR_CODES.EXP_001, { severity: 'error', cause });
    }
  }

  reset(): void {
    this.progressSignal.set({ phase: 'idle', count: 0, total: 0 });
  }

  private async collect(root: NativeDirRef, opts: ExportOptions): Promise<Zippable> {
    const out: Zippable = {};
    await walkAndCollect(this.fs, root, '', opts, out, (count) => {
      this.progressSignal.set({ phase: 'walking', count, total: count });
    });
    // why: once `.git` lives on OPFS (docs/deferred/versionado.md), the
    //      walk above — rooted at the real FS workspace — never finds it;
    //      shouldIncludeEntry()'s '.git' top-segment check exists
    //      specifically for `includeAllVariants`, so honor it by walking
    //      the OPFS side too, under the same '.git/' prefix the real-FS
    //      case would have produced.
    if (opts.includeAllVariants) {
      const gitDir = await this.opfsGitRoot.getGitDir();
      if (gitDir) {
        await walkAndCollect(this.fs, gitDir, '.git', opts, out, (count) => {
          this.progressSignal.set({ phase: 'walking', count, total: count });
        });
      }
    }
    return out;
  }
}

async function walkAndCollect(
  fs: FsService,
  dir: NativeDirRef,
  prefix: string,
  opts: ExportOptions,
  out: Zippable,
  onCount: (count: number) => void,
): Promise<void> {
  for await (const name of fs.listFiles(dir)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (!shouldIncludeEntry(rel, opts)) continue;
    const file = await fs.readFile(dir, name);
    const buf = new Uint8Array(await file.arrayBuffer());
    out[rel] = buf;
    onCount(Object.keys(out).length);
  }
  for await (const name of fs.listSubdirs(dir)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (!shouldIncludeEntry(rel, opts)) continue;
    const sub = await fs.getDir(dir, name);
    if (!sub) continue;
    await walkAndCollect(fs, sub, rel, opts, out, onCount);
  }
}

function zipAsync(tree: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(tree, { level: 6 }, (err, data) => {
      if (err) reject(new AppError(ERROR_CODES.EXP_002, { severity: 'error', cause: err }));
      else resolve(data);
    });
  });
}

function triggerDownload(data: Uint8Array, filename: string): void {
  const blob = new Blob([data as unknown as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
