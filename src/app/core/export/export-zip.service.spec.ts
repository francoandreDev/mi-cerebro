// docs/deferred/versionado.md — `.git` on OPFS. Once `.git` moves off the
// real workspace root, the plain walk over `root` never finds it again;
// this verifies the ZIP export's OPFS side-walk picks it back up under
// the same `.git/` prefix `shouldIncludeEntry` already expects.

import { TestBed } from '@angular/core/testing';
import type { Zippable } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';

import { NATIVE_FS } from '@core/fs/native-fs';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { BrowserNativeFs } from '@core/fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { OpfsGitRootService } from '@core/versioning/opfs-git-root';

import { ExportZipService } from './export-zip.service';
import type { ExportOptions } from './export-zip.types';

const nativeFs = new BrowserNativeFs();

class NotFound extends DOMException {
  constructor() {
    super('not found', 'NotFoundError');
  }
}

class MockFile {
  constructor(public data: Uint8Array) {}
  size = 0;
  lastModified = 1700000000000;
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    ) as ArrayBuffer;
  }
}
class MockWritable {
  constructor(private readonly target: MockFileHandle) {}
  async write(data: Uint8Array | string | Blob): Promise<void> {
    if (typeof data === 'string') this.target.contents = new TextEncoder().encode(data);
    else if (data instanceof Blob) this.target.contents = new Uint8Array(await data.arrayBuffer());
    else this.target.contents = new Uint8Array(data);
  }
  async close(): Promise<void> {
    /* no-op */
  }
}
class MockFileHandle {
  kind = 'file' as const;
  contents = new Uint8Array();
  constructor(
    public name: string,
    private parent?: MockDirHandle,
  ) {}
  async getFile(): Promise<MockFile> {
    const f = new MockFile(this.contents);
    f.size = this.contents.byteLength;
    return f;
  }
  async createWritable(): Promise<MockWritable> {
    return new MockWritable(this);
  }
  async move(dest: MockDirHandle, newName?: string): Promise<void> {
    const targetName = newName ?? this.name;
    if (this.parent) this.parent.children.delete(this.name);
    this.name = targetName;
    this.parent = dest;
    dest.children.set(targetName, this);
  }
}
class MockDirHandle {
  kind = 'directory' as const;
  readonly children = new Map<string, MockDirHandle | MockFileHandle>();
  constructor(public readonly name = '/') {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const e = this.children.get(name);
    if (e && e.kind === 'directory') return e;
    if (opts?.create) {
      const created = new MockDirHandle(name);
      this.children.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const e = this.children.get(name);
    if (e && e.kind === 'file') return e;
    if (opts?.create) {
      const created = new MockFileHandle(name, this);
      this.children.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async removeEntry(name: string): Promise<void> {
    this.children.delete(name);
  }
  async *keys(): AsyncIterable<string> {
    for (const k of this.children.keys()) yield k;
  }
  async *entries(): AsyncIterable<[string, MockDirHandle | MockFileHandle]> {
    for (const [k, v] of this.children) yield [k, v];
  }
}

function makeRoot(): { root: FsDirectoryHandle; mock: MockDirHandle } {
  const mock = new MockDirHandle();
  return { root: mock as unknown as FsDirectoryHandle, mock };
}

async function put(dir: FsDirectoryHandle, path: string, content: string): Promise<void> {
  await nativeFs.writeFileAtomic(dir, path, content);
}

interface CollectableService {
  collect(root: NativeDirRef, opts: ExportOptions): Promise<Zippable>;
}

describe('ExportZipService — OPFS .git side-walk', () => {
  let workdirRoot: FsDirectoryHandle;
  let opfsGitDir: FsDirectoryHandle;
  let opfsAvailable: boolean;

  beforeEach(async () => {
    ({ root: workdirRoot } = makeRoot());
    ({ root: opfsGitDir } = makeRoot());
    opfsAvailable = true;
    await put(workdirRoot, 'notes/n1.json', '{}');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NATIVE_FS, useValue: nativeFs },
        { provide: WorkspaceService, useValue: { root: () => workdirRoot } },
        {
          provide: OpfsGitRootService,
          useValue: { getGitDir: async () => (opfsAvailable ? opfsGitDir : null) },
        },
      ],
    });
  });

  it('includes OPFS .git contents under the .git/ prefix when includeAllVariants is on', async () => {
    await put(opfsGitDir, 'HEAD', 'ref: refs/heads/main\n');
    const service = TestBed.inject(ExportZipService) as unknown as CollectableService;

    const tree = await service.collect(workdirRoot, {
      includeAllVariants: true,
      includeAssets: true,
    });

    expect(Object.keys(tree)).toContain('notes/n1.json');
    expect(Object.keys(tree)).toContain('.git/HEAD');
  });

  it('omits .git entirely when includeAllVariants is off', async () => {
    await put(opfsGitDir, 'HEAD', 'ref: refs/heads/main\n');
    const service = TestBed.inject(ExportZipService) as unknown as CollectableService;

    const tree = await service.collect(workdirRoot, {
      includeAllVariants: false,
      includeAssets: true,
    });

    expect(Object.keys(tree).some((p) => p.startsWith('.git/'))).toBe(false);
  });

  it('does not walk OPFS when unavailable, without erroring', async () => {
    opfsAvailable = false;
    const service = TestBed.inject(ExportZipService) as unknown as CollectableService;

    const tree = await service.collect(workdirRoot, {
      includeAllVariants: true,
      includeAssets: true,
    });

    expect(Object.keys(tree)).toContain('notes/n1.json');
    expect(Object.keys(tree).some((p) => p.startsWith('.git/'))).toBe(false);
  });
});
