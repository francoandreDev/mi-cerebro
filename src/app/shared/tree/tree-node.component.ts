import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { BgColorDirective } from '@shared/directives/bg-color.directive';

import { TreeStateService } from './tree-state.service';
import type { TreeNode } from './tree.types';

@Component({
  selector: 'mc-tree-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BgColorDirective],
  template: `
    @if (visible().has(node().id)) {
      <li
        role="treeitem"
        [attr.aria-expanded]="hasChildren() ? expanded() : null"
        [attr.aria-selected]="selectedId() === node().id"
        [attr.data-id]="node().id"
        [class]="rowClass()"
        (click)="onRowClick($event)"
        (keydown.enter)="onRowClick($event)"
        (keydown.space)="onRowClick($event)"
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
            [visible]="visible()"
            [matchedIds]="matchedIds()"
            [selectedId]="selectedId()"
            (chooseNode)="chooseNode.emit($event)"
            (nodeAction)="nodeAction.emit($event)"
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
  readonly visible = input.required<ReadonlySet<string>>();
  readonly matchedIds = input.required<ReadonlySet<string>>();
  readonly selectedId = input<string | null>(null);
  readonly chooseNode = output<string>();
  readonly nodeAction = output<string>();

  private readonly state = inject(TreeStateService);

  protected readonly hasChildren = computed(() => (this.node().children?.length ?? 0) > 0);
  protected readonly hasActions = computed(() => {
    const kind = this.node().kind;
    return (
      kind === 'folder' || kind === 'note' || kind === 'task' || kind === 'goal' || kind === 'list'
    );
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
    if (this.hasChildren()) parts.push('group');
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
}
