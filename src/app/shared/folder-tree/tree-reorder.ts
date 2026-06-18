import { between } from '@core/ordering/fractional-position';
import type { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import type { TreeReorderEvent } from '@shared/tree/tree-node.component';

export interface EntitySummaryRef {
  readonly id: string;
  readonly folder: string;
  readonly position?: string;
}

export interface EntityReorderAdapter {
  readonly kind: string;
  readonly summaries: () => readonly EntitySummaryRef[];
  readonly moveToFolder: (id: string, folder: string) => Promise<void>;
  readonly setPosition: (id: string, position: string) => Promise<void>;
}

export interface ReorderOutcome {
  readonly idx: number;
}

export const parseEntityNodeId = (nodeId: string): string | null => {
  const colon = nodeId.indexOf(':');
  if (colon < 0) return null;
  const id = nodeId.slice(colon + 1);
  return id === '' ? null : id;
};

export const folderPathFromAnyParentId = (parentId: string, kind: string): string | null => {
  if (parentId === `root:${kind}`) return '';
  const prefix = `folder:${kind}:`;
  if (parentId.startsWith(prefix)) return parentId.slice(prefix.length);
  return null;
};

export const parseFolderNodeId = (
  nodeId: string,
): { readonly family: string; readonly path: string } | null => {
  if (!nodeId.startsWith('folder:')) return null;
  const rest = nodeId.slice('folder:'.length);
  const colon = rest.indexOf(':');
  if (colon < 0) return null;
  return { family: rest.slice(0, colon), path: rest.slice(colon + 1) };
};

export const parentOfPath = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
};

export const pickInsertIdx = (
  ids: readonly string[],
  targetId: string | null,
  edge: 'before' | 'after' | 'into',
): number | null => {
  if (edge === 'into') return ids.length;
  if (targetId === null) return null;
  const idx = ids.indexOf(targetId);
  if (idx < 0) return null;
  return edge === 'before' ? idx : idx + 1;
};

export const positionBetween = (
  siblings: readonly { readonly position: string }[],
  insertIdx: number,
): string | null => {
  const prev = siblings[insertIdx - 1]?.position ?? '';
  const next = siblings[insertIdx]?.position ?? '';
  if (prev !== '' && next !== '' && prev >= next) return null;
  return between(prev || null, next || null);
};

export const applyEntityReorder = async (
  event: TreeReorderEvent,
  adapter: EntityReorderAdapter,
): Promise<ReorderOutcome | null> => {
  if (event.movedKind !== adapter.kind) return null;
  const movedId = parseEntityNodeId(event.movedNodeId);
  if (!movedId) return null;
  const newFolder = folderPathFromAnyParentId(event.newParentId, adapter.kind);
  const oldFolder = folderPathFromAnyParentId(event.oldParentId, adapter.kind);
  if (newFolder === null || oldFolder === null) return null;
  if (oldFolder !== newFolder) await adapter.moveToFolder(movedId, newFolder);
  const siblings = adapter
    .summaries()
    .filter((s) => s.folder === newFolder)
    .map((s) => ({ id: s.id, position: s.position ?? '' }))
    .filter((s) => s.id !== movedId);
  const targetId = event.edge === 'into' ? null : parseEntityNodeId(event.targetNodeId);
  const idx = pickInsertIdx(
    siblings.map((s) => s.id),
    targetId,
    event.edge,
  );
  if (idx === null) return null;
  const newPosition = positionBetween(siblings, idx);
  if (newPosition === null) return null;
  await adapter.setPosition(movedId, newPosition);
  return { idx };
};

export const applyFolderReorder = async (
  event: TreeReorderEvent,
  kind: FolderKind,
  folders: FoldersService,
): Promise<ReorderOutcome | null> => {
  const src = parseFolderNodeId(event.movedNodeId);
  if (!src || src.family !== kind) return null;
  const newParentPath = resolveFolderNewParent(src, event, kind);
  if (newParentPath === null) return null;
  let finalPath = src.path;
  if (parentOfPath(src.path) !== newParentPath) {
    finalPath = await folders.moveFolder(kind, src.path, newParentPath);
  }
  const positions = await folders.getFolderPositions(kind);
  const siblings = Object.entries(positions)
    .filter(([path]) => parentOfPath(path) === newParentPath)
    .map(([path, position]) => ({ id: path, position }))
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    .filter((s) => s.id !== finalPath);
  const targetId =
    event.edge === 'into' ? null : (parseFolderNodeId(event.targetNodeId)?.path ?? null);
  const idx = pickInsertIdx(
    siblings.map((s) => s.id),
    targetId,
    event.edge,
  );
  if (idx === null) return null;
  const newPosition = positionBetween(siblings, idx);
  if (newPosition === null) return null;
  await folders.setFolderPosition(kind, finalPath, newPosition);
  return { idx };
};

const resolveFolderNewParent = (
  src: { readonly path: string; readonly family: string },
  event: TreeReorderEvent,
  kind: FolderKind,
): string | null => {
  let newParentPath: string | null;
  if (event.edge === 'into') {
    const tgt = parseFolderNodeId(event.targetNodeId);
    if (!tgt || tgt.family !== kind) return null;
    newParentPath = tgt.path;
  } else {
    newParentPath = folderPathFromAnyParentId(event.newParentId, kind);
  }
  if (newParentPath === null) return null;
  if (newParentPath === src.path || newParentPath.startsWith(`${src.path}/`)) return null;
  return newParentPath;
};
