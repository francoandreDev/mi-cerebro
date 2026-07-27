import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { folderCrumbs, folderLeafName, immediateChildFolders } from './folder-children';

@Component({
  selector: 'mc-folder-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <nav class="trail" [attr.aria-label]="t('folders.breadcrumbLabel')">
      <button
        type="button"
        class="crumb"
        data-tutorial="folder-breadcrumb-root"
        [class.current]="currentPath() === ''"
        (click)="navigate.emit('')"
      >
        <mc-icon name="folder" aria-hidden="true" />
        {{ t('folders.root') }}
      </button>
      @for (crumb of crumbs(); track crumb.path) {
        <mc-icon name="caret-right" class="sep" aria-hidden="true" />
        <button
          type="button"
          class="crumb"
          [class.current]="crumb.path === currentPath()"
          (click)="navigate.emit(crumb.path)"
        >
          {{ crumb.label }}
        </button>
      }
      <button
        type="button"
        class="add-subfolder mc-hover-wiggle"
        data-tutorial="folder-breadcrumb-add"
        [attr.aria-label]="t('folders.addSubfolder')"
        (click)="createSubfolder.emit()"
      >
        <mc-icon name="folder-plus" aria-hidden="true" />
      </button>
    </nav>
    @if (children().length > 0) {
      <div class="children" role="list" [attr.aria-label]="t('folders.actions')">
        @for (child of children(); track child) {
          <div
            class="child"
            role="listitem"
            data-tutorial="folder-breadcrumb-child"
            [class.drag-over]="dragOverChild() === child"
            (dragover)="onChildDragOver(child, $event)"
            (dragleave)="onChildDragLeave(child)"
            (drop)="onChildDrop(child, $event)"
          >
            <button type="button" class="child-open" (click)="navigate.emit(child)">
              <mc-icon name="folder" aria-hidden="true" />
              {{ leafName(child) }}
            </button>
            <button
              type="button"
              class="child-manage"
              data-tutorial="folder-breadcrumb-child-manage"
              [attr.aria-label]="t('folders.actions')"
              (click)="manageFolder.emit(child)"
            >
              <mc-icon name="dots-three-vertical" aria-hidden="true" />
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
    }
    .trail {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .crumb {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      padding: 2px 6px;
      border-radius: var(--mc-radius-sm);
    }
    .crumb:hover {
      background: var(--mc-bg-elevated);
      color: var(--mc-fg-primary);
    }
    .crumb.current {
      color: var(--mc-fg-primary);
      font-weight: 600;
    }
    .sep {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .add-subfolder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px dashed var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 6px;
      margin-inline-start: 4px;
    }
    .add-subfolder:hover {
      color: var(--mc-accent-primary);
      border-color: var(--mc-accent-primary);
    }
    .children {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .child {
      display: inline-flex;
      align-items: center;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      overflow: hidden;
    }
    .child.drag-over {
      outline: 2px solid var(--mc-accent-primary);
      outline-offset: 1px;
    }
    .child-open,
    .child-manage {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      padding: 4px 8px;
    }
    .child-open:hover,
    .child-manage:hover {
      background: var(--mc-bg-hover, rgba(128, 128, 128, 0.12));
    }
    .child-manage {
      padding-inline: 6px;
      color: var(--mc-fg-muted);
      border-inline-start: 1px solid var(--mc-border-default);
    }
  `,
})
export class FolderBreadcrumbComponent {
  readonly currentPath = input.required<string>();
  readonly allFolders = input.required<readonly string[]>();

  readonly navigate = output<string>();
  readonly createSubfolder = output<void>();
  readonly manageFolder = output<string>();
  // why: dejamos que quien arrastra decida si hay algo arrastrable (llama
  //      preventDefault en dragover) — este componente no asume ningún
  //      modelo de datos de drag, sólo reenvía path + evento nativo.
  readonly childDragOver = output<{ path: string; event: DragEvent }>();
  readonly childDrop = output<{ path: string; event: DragEvent }>();

  private readonly i18n = inject(I18nService);

  protected readonly dragOverChild = signal<string | null>(null);

  protected readonly crumbs = computed(() => folderCrumbs(this.currentPath()));
  protected readonly children = computed(() =>
    immediateChildFolders(this.allFolders(), this.currentPath()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected leafName(path: string): string {
    return folderLeafName(path);
  }

  protected onChildDragOver(child: string, event: DragEvent): void {
    this.childDragOver.emit({ path: child, event });
    this.dragOverChild.set(child);
  }

  protected onChildDragLeave(child: string): void {
    if (this.dragOverChild() === child) this.dragOverChild.set(null);
  }

  protected onChildDrop(child: string, event: DragEvent): void {
    this.dragOverChild.set(null);
    this.childDrop.emit({ path: child, event });
  }
}
