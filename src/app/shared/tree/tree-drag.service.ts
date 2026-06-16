import { Injectable, computed, signal } from '@angular/core';

export type DropEdge = 'before' | 'after' | 'into';

export interface DragSource {
  readonly nodeId: string;
  readonly kind: string;
  readonly parentId: string;
  // why: when dragging a folder we need its family (the kind it lives in) and
  //      its absolute path to validate cross-folder drops and reject drops on
  //      descendants of the source.
  readonly family?: string;
  readonly path?: string;
}

export interface DropTarget {
  readonly nodeId: string;
  readonly edge: DropEdge;
}

export interface DropTargetContext {
  readonly nodeId: string;
  readonly kind: string;
  readonly parentId: string;
  readonly family?: string;
  readonly path?: string;
}

@Injectable({ providedIn: 'root' })
export class TreeDragService {
  private readonly sourceSignal = signal<DragSource | null>(null);
  private readonly targetSignal = signal<DropTarget | null>(null);

  readonly source = this.sourceSignal.asReadonly();
  readonly target = this.targetSignal.asReadonly();

  readonly isDragging = computed(() => this.sourceSignal() !== null);

  begin(src: DragSource): void {
    this.sourceSignal.set(src);
    this.targetSignal.set(null);
  }

  setTarget(target: DropTarget | null): void {
    this.targetSignal.set(target);
  }

  clearTargetIf(nodeId: string): void {
    const cur = this.targetSignal();
    if (cur?.nodeId === nodeId) this.targetSignal.set(null);
  }

  end(): void {
    this.sourceSignal.set(null);
    this.targetSignal.set(null);
  }

  canDropOn(target: DropTargetContext, edge: DropEdge): boolean {
    const src = this.sourceSignal();
    if (!src) return false;
    if (src.nodeId === target.nodeId) return false;
    if (src.kind === 'folder') return this.canDropFolderOn(src, target, edge);
    return this.canDropEntityOn(src, target, edge);
  }

  // why: entities can move across folders within the same kind. Drops on folder
  //      rows mean "move inside the folder" and only make sense with edge=into.
  private canDropEntityOn(src: DragSource, target: DropTargetContext, edge: DropEdge): boolean {
    if (target.kind === 'folder') {
      if (edge !== 'into') return false;
      return target.family === src.kind;
    }
    if (edge === 'into') return false;
    return src.kind === target.kind;
  }

  // why: folders only land on folder rows of the same family. Dropping a
  //      folder inside itself or any descendant would form a cycle on the FS.
  private canDropFolderOn(src: DragSource, target: DropTargetContext, edge: DropEdge): boolean {
    if (target.kind !== 'folder') return false;
    if (target.family !== src.family) return false;
    const srcPath = src.path ?? '';
    const tgtPath = target.path ?? '';
    if (tgtPath === srcPath) return false;
    if (tgtPath.startsWith(`${srcPath}/`)) return false;
    return edge === 'into' || edge === 'before' || edge === 'after';
  }
}
