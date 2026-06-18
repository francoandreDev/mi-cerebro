import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CommandPaletteService } from '@core/search/command-palette.service';
import { TagsService } from '@core/tags/tags.service';
import { buildFolderTree } from '@shared/folder-tree/folder-tree';
import {
  applyEntityReorder,
  applyFolderReorder,
  type EntityReorderAdapter,
} from '@shared/folder-tree/tree-reorder';
import { IconComponent } from '@shared/icon/icon.component';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent, type FilterMatchEntry } from '@shared/tree/tree-filter.component';
import { TreeStateService } from '@shared/tree/tree-state.service';
import type { TreeReorderEvent } from '@shared/tree/tree-node.component';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode, TreeNodeBadge } from '@shared/tree/tree.types';

import { FILE_KIND } from '../models/file-collection.types';
import { FilesService } from '../services/files.service';

@Component({
  selector: 'mc-files-index-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeComponent, TreeFilterComponent, IconComponent],
  templateUrl: './files-index-rail.container.html',
  styleUrl: './files-index-rail.container.css',
})
export class FilesIndexRailContainer {
  private readonly filesService = inject(FilesService);
  private readonly foldersService = inject(FoldersService);
  private readonly tagsService = inject(TagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly palette = inject(CommandPaletteService);
  private readonly treeState = inject(TreeStateService);

  protected readonly query = signal('');
  protected readonly direction = signal<FilterDirection>('general');
  private readonly cursor = signal(0);

  protected readonly treeRoots = computed<readonly TreeNode[]>(() => {
    const lookup = new Map(this.tagsService.tags().map((t) => [t.id, t]));
    return buildFolderTree({
      idPrefix: FILE_KIND,
      entities: this.filesService.summaries().map((c) => ({
        id: c.id,
        folder: c.folder,
        label: c.title || this.i18n.t('files.untitledTitle'),
        badges: tagBadges(c.tags, lookup),
      })),
      folders: this.filesService.folders(),
    });
  });

  protected readonly treeRootParentId = `root:${FILE_KIND}`;

  protected readonly selectedNodeId = computed<string | null>(() => {
    const url = this.router.url;
    const match = /^\/files\/([^/?]+)/.exec(url);
    return match ? `${FILE_KIND}:${match[1]}` : null;
  });

  protected readonly result = computed(() =>
    filterTree(this.treeRoots(), this.query(), this.selectedNodeId(), this.direction()),
  );

  protected readonly matchedIds = computed(() => new Set(this.result().matches.map((m) => m.id)));

  protected readonly activeMatchId = computed<string | null>(
    () => this.result().matches[this.cursor()]?.id ?? null,
  );

  private readonly nodeLabels = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    const walk = (node: TreeNode): void => {
      map.set(node.id, node.label);
      for (const c of node.children ?? []) walk(c);
    };
    for (const r of this.treeRoots()) walk(r);
    return map;
  });

  protected readonly filterMatches = computed<readonly FilterMatchEntry[]>(() => {
    const labels = this.nodeLabels();
    return this.result().matches.map((m) => ({
      id: m.id,
      label: labels.get(m.id) ?? m.id,
      breadcrumb: m.path.map((id) => labels.get(id) ?? id).join(' / '),
    }));
  });

  protected readonly emptyKey = computed<TranslationKey>(() =>
    this.query().trim() !== '' ? 'tree.noMatches' : 'files.empty',
  );

  protected readonly filterPlaceholder = computed<string>(() => {
    const kindLabel = this.t('tree.type.files');
    return this.t('tree.filter.placeholderIn').replace('{kind}', kindLabel);
  });

  private readonly reorderAnnouncementSignal = signal('');
  protected readonly reorderAnnouncement = this.reorderAnnouncementSignal.asReadonly();

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected openPalette(): void {
    this.palette.show();
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.cursor.set(0);
  }

  protected onDirection(d: FilterDirection): void {
    this.direction.set(d);
    this.cursor.set(0);
  }

  protected onNext(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c + 1) % total);
    this.jumpToCursor();
  }

  protected onPrev(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c - 1 + total) % total);
    this.jumpToCursor();
  }

  protected onActivateFirst(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  protected onChooseMatch(id: string): void {
    const idx = this.result().matches.findIndex((m) => m.id === id);
    if (idx >= 0) this.cursor.set(idx);
    this.choose(id);
  }

  protected onClear(): void {
    if (this.query() === '') return;
    this.query.set('');
    this.cursor.set(0);
  }

  protected choose(nodeId: string): void {
    const colon = nodeId.indexOf(':');
    if (colon < 0) return;
    const id = nodeId.slice(colon + 1);
    void this.router.navigate(['/files', id]);
  }

  protected async onCreateCollection(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const created = await this.filesService.createCollection('');
      this.treeState.expandAll([this.treeRootParentId]);
      await this.router.navigate(['/files', created.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onCreateFolder(): Promise<void> {
    const name = prompt(this.t('folders.createPrompt'), '');
    if (name === null || name.trim() === '') return;
    try {
      await this.workspace.ensureWritable();
      await this.foldersService.createFolder(FILE_KIND, '', name.trim());
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onNodeAction(nodeId: string): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      if (nodeId.startsWith('folder:')) {
        await this.handleFolderAction(nodeId.slice('folder:'.length));
      } else {
        await this.handleEntityAction(nodeId);
      }
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onReorder(event: TreeReorderEvent): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      if (event.movedKind === 'folder') {
        const outcome = await applyFolderReorder(event, FILE_KIND, this.foldersService);
        if (outcome) this.announceMoved(outcome.idx);
      } else {
        const adapter: EntityReorderAdapter = {
          kind: FILE_KIND,
          summaries: () => this.filesService.summaries(),
          moveToFolder: (id, folder) => this.filesService.moveCollectionToFolder(id, folder),
          setPosition: (id, position) => this.filesService.setPosition(id, position),
        };
        const outcome = await applyEntityReorder(event, adapter);
        if (outcome) this.announceMoved(outcome.idx);
      }
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private async handleFolderAction(rest: string): Promise<void> {
    const colon = rest.indexOf(':');
    const path = colon < 0 ? rest : rest.slice(colon + 1);
    const choice = prompt(
      `${this.t('folders.actionPrompt')}\n1=${this.t('folders.rename')}\n2=${this.t('folders.move')}\n3=${this.t('folders.delete')}`,
      '1',
    );
    if (choice === null) return;
    if (choice === '1') {
      const next = prompt(this.t('folders.renamePrompt'), pathLeaf(path));
      if (next === null || next.trim() === '') return;
      await this.foldersService.renameFolder(FILE_KIND, path, next.trim());
    } else if (choice === '2') {
      const next = prompt(this.t('folders.movePrompt'), pathParent(path));
      if (next === null) return;
      await this.foldersService.moveFolder(FILE_KIND, path, next.trim());
    } else if (choice === '3') {
      if (!confirm(this.t('folders.deleteConfirm').replace('{path}', path))) return;
      await this.foldersService.deleteFolder(FILE_KIND, path);
    }
  }

  private async handleEntityAction(nodeId: string): Promise<void> {
    const colon = nodeId.indexOf(':');
    const id = nodeId.slice(colon + 1);
    const newFolder = prompt(this.t('folders.entityMovePrompt'), '');
    if (newFolder === null) return;
    await this.filesService.moveCollectionToFolder(id, newFolder.trim());
  }

  private jumpToCursor(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  private announceMoved(idx: number): void {
    this.reorderAnnouncementSignal.set(
      this.t('tree.reorder.moved').replace('{position}', String(idx + 1)),
    );
  }
}

const tagBadges = (
  ids: readonly string[],
  lookup: ReadonlyMap<string, { id: string; label: string; color: string }>,
): readonly TreeNodeBadge[] => {
  const out: TreeNodeBadge[] = [];
  for (const id of ids) {
    const tag = lookup.get(id);
    if (tag) out.push({ id: tag.id, label: tag.label, color: tag.color });
  }
  return out;
};

const pathLeaf = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
};

const pathParent = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
};
