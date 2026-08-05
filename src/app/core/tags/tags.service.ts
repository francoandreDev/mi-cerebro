import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { toSlug } from '@shared/utils/slug';

import {
  TAGS_FILE,
  TAG_KIND,
  TAG_SCHEMA_VERSION,
  colorForId,
  type Tag,
  type TagsFile,
} from './tag.types';

@Injectable({ providedIn: 'root' })
export class TagsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);

  private readonly tagsSignal = signal<readonly Tag[]>([]);
  private readonly byIdSignal = computed(() => {
    const map = new Map<string, Tag>();
    for (const t of this.tagsSignal()) map.set(t.id, t);
    return map;
  });
  private loaded = false;

  readonly tags = this.tagsSignal.asReadonly();

  constructor() {
    this.migrations.register({ kind: TAG_KIND, latest: TAG_SCHEMA_VERSION, steps: [] });
  }

  byId(id: string): Tag | undefined {
    return this.byIdSignal().get(id);
  }

  async refresh(): Promise<readonly Tag[]> {
    const root = this.requireRoot();
    const exists = await this.fs.hasEntry(root, TAGS_FILE);
    const data: TagsFile = exists
      ? await this.fs.readJson<TagsFile>(root, TAGS_FILE)
      : { schemaVersion: TAG_SCHEMA_VERSION, tags: [] };
    const migrated = await this.migrations.migrate<TagsFile>(TAG_KIND, data);
    const sorted = [...migrated.tags].sort((a, b) => a.label.localeCompare(b.label));
    this.tagsSignal.set(sorted);
    this.loaded = true;
    return sorted;
  }

  async touch(label: string): Promise<Tag> {
    if (!this.loaded) await this.refresh();
    const trimmed = label.trim();
    if (trimmed === '') throw new AppError(ERROR_CODES.ENT_001, { severity: 'warning' });
    const id = toSlug(trimmed, 'tag');
    const existing = this.byId(id);
    if (existing) return existing;
    const tag: Tag = {
      id,
      label: trimmed,
      color: colorForId(id),
      createdAt: new Date().toISOString(),
    };
    await this.persist([...this.tagsSignal(), tag]);
    return tag;
  }

  async rename(id: string, newLabel: string): Promise<Tag> {
    const trimmed = newLabel.trim();
    if (trimmed === '') throw new AppError(ERROR_CODES.ENT_001, { severity: 'warning' });
    const current = this.byId(id);
    if (!current) throw new AppError(ERROR_CODES.ENT_001, { severity: 'warning', context: { id } });
    const updated: Tag = { ...current, label: trimmed };
    await this.persist(this.tagsSignal().map((t) => (t.id === id ? updated : t)));
    return updated;
  }

  async remove(id: string): Promise<void> {
    if (!this.byId(id)) return;
    await this.persist(this.tagsSignal().filter((t) => t.id !== id));
  }

  async setSwatch(id: string, swatchId: string | null): Promise<void> {
    const current = this.byId(id);
    if (!current) return;
    const next: Tag =
      swatchId === null
        ? withoutColorOverrides(current)
        : { ...withoutKey(current, 'colorHex'), colorSwatchId: swatchId };
    await this.persist(this.tagsSignal().map((t) => (t.id === id ? next : t)));
  }

  async setCustomColor(id: string, hex: string | null): Promise<void> {
    const current = this.byId(id);
    if (!current) return;
    const next: Tag =
      hex === null
        ? withoutColorOverrides(current)
        : { ...withoutKey(current, 'colorSwatchId'), colorHex: hex };
    await this.persist(this.tagsSignal().map((t) => (t.id === id ? next : t)));
  }

  private async persist(next: readonly Tag[]): Promise<void> {
    const root = this.requireRoot();
    const sorted = [...next].sort((a, b) => a.label.localeCompare(b.label));
    const file: TagsFile = { schemaVersion: TAG_SCHEMA_VERSION, tags: sorted };
    await this.fs.writeFileAtomic(root, TAGS_FILE, JSON.stringify(file, null, 2));
    this.tagsSignal.set(sorted);
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }
}

function withoutKey(tag: Tag, key: 'colorSwatchId' | 'colorHex'): Tag {
  const next: Record<string, unknown> = { ...tag };
  delete next[key];
  return next as Tag;
}

function withoutColorOverrides(tag: Tag): Tag {
  return withoutKey(withoutKey(tag, 'colorSwatchId'), 'colorHex');
}
