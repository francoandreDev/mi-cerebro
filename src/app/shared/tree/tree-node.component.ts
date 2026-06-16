import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { BgColorDirective } from '@shared/directives/bg-color.directive';

import { TreeDragService, type DropEdge, type DropTargetContext } from './tree-drag.service';
import { TreeStateService } from './tree-state.service';
import type { TreeNode } from './tree.types';

export interface TreeReorderEvent {
  readonly movedNodeId: string;
  readonly movedKind: string;
  readonly targetNodeId: string;
  readonly edge: DropEdge;
  readonly newParentId: string;
  readonly oldParentId: string;
}

@Component({
  selector: 'mc-tree-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgColorDirective],
  template: `
    @if (visible().has(node().id)) {
      <li
        #row
        role="treeitem"
        [attr.aria-expanded]="hasChildren() ? expanded() : null"
        [attr.aria-selected]="selectedId() === node().id"
        [attr.aria-grabbed]="isBeingDragged()"
        [attr.aria-dropeffect]="canAcceptAnyEdge() ? 'move' : null"
        [attr.data-id]="node().id"
        [attr.draggable]="'true'"
        [class]="rowClass()"
        (click)="onRowClick($event)"
        (keydown.enter)="onRowClick($event)"
        (keydown.space)="onRowClick($event)"
        (dragstart)="onDragStart($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (dragend)="onDragEnd()"
        tabindex="-1"
      >
        @if (hasChildren()) {
          <button
            type="button"
            class="chevron"
            [attr.aria-label]="expanded() ? 'collapse' : 'expand'"
            (click)="onToggle($event)"
          >
            {{ expanded() ? '▾' : '▸' }}
          </button>
        } @else {
          <span class="chevron-spacer"></span>
        }
        <span class="label">{{ node().label }}</span>
        @if (node().badges?.length) {
          <span class="badges">
            @for (b of node().badges ?? []; track b.id) {
              <span class="badge" [mcBgColor]="b.color" [title]="b.label"></span>
            }
          </span>
        }
        @if (hasActions()) {
          <button
            type="button"
            class="actions"
            [attr.aria-label]="'actions'"
            (click)="onActions($event)"
          >
            ⋯
          </button>
        }
      </li>
      @if (hasChildren() && expanded()) {
        @for (child of node().children; track child.id) {
          <mc-tree-node
            [node]="child"
            [depth]="depth() + 1"
            [parentId]="node().id"
            [visible]="visible()"
            [matchedIds]="matchedIds()"
            [activeMatchId]="activeMatchId()"
            [selectedId]="selectedId()"
            (chooseNode)="chooseNode.emit($event)"
            (nodeAction)="nodeAction.emit($event)"
            (reorder)="reorder.emit($event)"
          />
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-1);
      padding: var(--mc-space-1) var(--mc-space-3);
      cursor: pointer;
      list-style: none;
      user-select: none;
      border-top: 2px solid transparent;
      border-bottom: 2px solid transparent;
    }
    .row.d-0 {
      padding-left: 12px;
    }
    .row.d-1 {
      padding-left: 28px;
    }
    .row.d-2 {
      padding-left: 44px;
    }
    .row.d-3 {
      padding-left: 60px;
    }
    .row.d-4 {
      padding-left: 76px;
    }
    .row.d-5 {
      padding-left: 92px;
    }
    .row.d-6 {
      padding-left: 108px;
    }
    .row.d-7 {
      padding-left: 124px;
    }
    .row.d-8 {
      padding-left: 140px;
    }
    .row.d-9 {
      padding-left: 156px;
    }
    .row:hover {
      background: var(--mc-bg-elevated);
    }
    .row.selected {
      background: var(--mc-bg-elevated);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .row.match .label {
      color: var(--mc-accent-primary);
      font-weight: 600;
    }
    .row.active-match {
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: -2px;
    }
    .row.dragging {
      opacity: 0.5;
    }
    .row.drop-before {
      border-top-color: var(--mc-accent-primary);
    }
    .row.drop-after {
      border-bottom-color: var(--mc-accent-primary);
    }
    .row.drop-into {
      outline: 2px dashed var(--mc-accent-primary);
      outline-offset: -2px;
    }
    .chevron {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-muted);
      width: 1.2rem;
      text-align: center;
    }
    .chevron-spacer {
      display: inline-block;
      width: 1.2rem;
    }
    .label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badges {
      display: inline-flex;
      gap: 3px;
      align-items: center;
      flex-shrink: 0;
    }
    .badge {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .actions {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 0 var(--mc-space-1);
      visibility: hidden;
      font-size: var(--mc-font-size-md);
      line-height: 1;
    }
    .row:hover .actions,
    .row.selected .actions {
      visibility: visible;
    }
    .actions:hover {
      color: var(--mc-fg-primary);
    }
  `,
})
export class TreeNodeComponent {
  readonly node = input.required<TreeNode>();
  readonly depth = input<number>(0);
  readonly parentId = input<string>('');
  readonly visible = input.required<ReadonlySet<string>>();
  readonly matchedIds = input.required<ReadonlySet<string>>();
  readonly activeMatchId = input<string | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly chooseNode = output<string>();
  readonly nodeAction = output<string>();
  readonly reorder = output<TreeReorderEvent>();

  private readonly state = inject(TreeStateService);
  private readonly drag = inject(TreeDragService);
  private readonly row = viewChild<ElementRef<HTMLLIElement>>('row');

  constructor() {
    effect(() => {
      if (this.activeMatchId() !== this.node().id) return;
      const el = this.row()?.nativeElement;
      if (!el) return;
      queueMicrotask(() => el.scrollIntoView({ block: 'nearest' }));
    });
  }

  protected readonly hasChildren = computed(() => (this.node().children?.length ?? 0) > 0);
  protected readonly hasActions = computed(() => {
    const kind = this.node().kind;
    return (
      kind === 'folder' ||
      kind === 'note' ||
      kind === 'task' ||
      kind === 'goal' ||
      kind === 'list' ||
      kind === 'writing' ||
      kind === 'book' ||
      kind === 'image' ||
      kind === 'file'
    );
  });

  // why: folder nodes carry their family + path inside their id
  //      (`folder:<family>:<path>`). We expose them so the drag service can
  //      enforce same-family and reject descendant drops.
  private readonly folderInfo = computed(() => {
    const id = this.node().id;
    if (this.node().kind !== 'folder' || !id.startsWith('folder:')) return null;
    const rest = id.slice('folder:'.length);
    const colon = rest.indexOf(':');
    if (colon < 0) return null;
    return { family: rest.slice(0, colon), path: rest.slice(colon + 1) };
  });

  protected readonly isBeingDragged = computed(() => this.drag.source()?.nodeId === this.node().id);

  private readonly targetContext = computed<DropTargetContext>(() => {
    const info = this.folderInfo();
    const base = {
      nodeId: this.node().id,
      kind: this.node().kind,
      parentId: this.parentId(),
    };
    return info ? { ...base, family: info.family, path: info.path } : base;
  });

  protected readonly canAcceptAnyEdge = computed(() => {
    const ctx = this.targetContext();
    return (
      this.drag.canDropOn(ctx, 'before') ||
      this.drag.canDropOn(ctx, 'after') ||
      this.drag.canDropOn(ctx, 'into')
    );
  });

  private readonly hoverEdge = computed<DropEdge | null>(() => {
    const t = this.drag.target();
    if (!t || t.nodeId !== this.node().id) return null;
    if (!this.drag.canDropOn(this.targetContext(), t.edge)) return null;
    return t.edge;
  });

  protected onActions(event: Event): void {
    event.stopPropagation();
    this.nodeAction.emit(this.node().id);
  }
  protected readonly expanded = computed(() => this.state.expanded().has(this.node().id));
  protected readonly rowClass = computed(() => {
    const parts = ['row', `d-${Math.min(this.depth(), 9)}`];
    if (this.selectedId() === this.node().id) parts.push('selected');
    if (this.matchedIds().has(this.node().id)) parts.push('match');
    if (this.activeMatchId() === this.node().id) parts.push('active-match');
    if (this.hasChildren()) parts.push('group');
    if (this.isBeingDragged()) parts.push('dragging');
    const edge = this.hoverEdge();
    if (edge === 'before') parts.push('drop-before');
    if (edge === 'after') parts.push('drop-after');
    if (edge === 'into') parts.push('drop-into');
    return parts.join(' ');
  });

  protected onToggle(event: Event): void {
    event.stopPropagation();
    this.state.toggle(this.node().id);
  }

  protected onRowClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.chevron')) return;
    event.preventDefault();
    if (this.hasChildren()) {
      this.state.toggle(this.node().id);
      return;
    }
    this.chooseNode.emit(this.node().id);
  }

  protected onDragStart(event: DragEvent): void {
    const info = this.folderInfo();
    const base = {
      nodeId: this.node().id,
      kind: this.node().kind,
      parentId: this.parentId(),
    };
    this.drag.begin(info ? { ...base, family: info.family, path: info.path } : base);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // why: Firefox refuses to fire `drag*` events unless setData runs
      //      during dragstart, even if we never read the payload back.
      event.dataTransfer.setData('text/plain', this.node().id);
    }
  }

  protected onDragOver(event: DragEvent): void {
    if (this.isBeingDragged()) return;
    const el = this.row()?.nativeElement;
    if (!el) return;
    const edge = this.pickEdge(event, el);
    if (edge === null) return;
    if (!this.drag.canDropOn(this.targetContext(), edge)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const current = this.drag.target();
    if (current?.nodeId === this.node().id && current.edge === edge) return;
    this.drag.setTarget({ nodeId: this.node().id, edge });
  }

  // why: folder rows split the row into three zones (before / into / after)
  //      so the user can pick between reorder and "drop inside". Entity rows
  //      keep the two-zone split because dropping "into" an entity has no
  //      meaning in this tree.
  private pickEdge(event: DragEvent, el: HTMLElement): DropEdge | null {
    const rect = el.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const h = rect.height;
    if (this.node().kind === 'folder') {
      // why: only folder sources can land before/after a folder row (folder
      //      reordering). Entities dropped on a folder always mean "into".
      const srcKind = this.drag.source()?.kind;
      if (srcKind !== 'folder') return 'into';
      if (y < h * 0.25) return 'before';
      if (y > h * 0.75) return 'after';
      return 'into';
    }
    return y < h / 2 ? 'before' : 'after';
  }

  protected onDragLeave(event: DragEvent): void {
    const el = this.row()?.nativeElement;
    if (!el) return;
    const related = event.relatedTarget as Node | null;
    if (related && el.contains(related)) return;
    this.drag.clearTargetIf(this.node().id);
  }

  protected onDrop(event: DragEvent): void {
    const src = this.drag.source();
    const target = this.drag.target();
    if (!src || !target || target.nodeId !== this.node().id) {
      this.drag.end();
      return;
    }
    if (!this.drag.canDropOn(this.targetContext(), target.edge)) {
      this.drag.end();
      return;
    }
    if (src.nodeId === this.node().id) {
      this.drag.end();
      return;
    }
    event.preventDefault();
    const newParentId = target.edge === 'into' ? this.node().id : this.parentId();
    this.reorder.emit({
      movedNodeId: src.nodeId,
      movedKind: src.kind,
      targetNodeId: this.node().id,
      edge: target.edge,
      newParentId,
      oldParentId: src.parentId,
    });
    this.drag.end();
  }

  protected onDragEnd(): void {
    this.drag.end();
  }
}
