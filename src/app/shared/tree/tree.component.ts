import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { TreeNodeComponent, type TreeReorderEvent } from './tree-node.component';
import { TreeStateService } from './tree-state.service';
import type { TreeNode } from './tree.types';

@Component({
  selector: 'mc-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeNodeComponent],
  template: `
    @if (visibleCount() === 0) {
      <p class="empty">{{ t(emptyKey()) }}</p>
    } @else {
      <ul class="tree" role="tree">
        @for (root of nodes(); track root.id) {
          <mc-tree-node
            [node]="root"
            [depth]="0"
            [parentId]="rootParentId()"
            [visible]="visible()"
            [matchedIds]="matchedIds()"
            [activeMatchId]="activeMatchId()"
            [selectedId]="selectedId()"
            (chooseNode)="chooseNode.emit($event)"
            (nodeAction)="nodeAction.emit($event)"
            (reorder)="reorder.emit($event)"
          />
        }
      </ul>
    }
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
  `,
  styles: `
    :host {
      display: block;
      overflow-y: auto;
      flex: 1;
    }
    .tree {
      list-style: none;
      margin: 0;
      padding: var(--mc-space-1) 0;
    }
    .empty {
      padding: var(--mc-space-4);
      color: var(--mc-fg-muted);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class TreeComponent {
  readonly nodes = input.required<readonly TreeNode[]>();
  readonly visible = input.required<ReadonlySet<string>>();
  readonly matchedIds = input.required<ReadonlySet<string>>();
  readonly activeMatchId = input<string | null>(null);
  readonly autoExpand = input<ReadonlySet<string>>(new Set());
  readonly selectedId = input<string | null>(null);
  readonly emptyKey = input<TranslationKey>('notes.empty');
  readonly rootParentId = input<string>('');
  readonly announcement = input<string>('');
  readonly chooseNode = output<string>();
  readonly nodeAction = output<string>();
  readonly reorder = output<TreeReorderEvent>();

  private readonly state = inject(TreeStateService);
  private readonly i18n = inject(I18nService);

  protected readonly visibleCount = computed(() => this.visible().size);

  constructor() {
    effect(() => {
      const ids = this.autoExpand();
      if (ids.size > 0) this.state.expandAll(ids);
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
