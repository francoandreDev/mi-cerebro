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

import {
  displayLabel,
  extFromName,
  formatBytes,
  type FileItem,
} from '../models/file-collection.types';

export type FileArtifactVariant =
  | 'polaroid'
  | 'pdf-sheet'
  | 'thermal-receipt'
  | 'envelope'
  | 'cassette'
  | 'vhs'
  | 'postit';

export interface FilePreview {
  readonly kind: 'image' | 'pdf';
  readonly url: string;
}

// why: cheap deterministic hash so jitter/pin colour are stable per file id
//      across re-renders without persisting anything to disk.
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const PIN_HUES = [4, 38, 130, 205, 280, 340] as const;

@Component({
  selector: 'mc-file-artifact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './file-artifact.component.html',
  styleUrl: './file-artifact.component.css',
})
export class FileArtifactComponent {
  readonly item = input.required<FileItem>();
  readonly preview = input<FilePreview | null>(null);
  readonly editable = input<boolean>(true);
  readonly canMoveUp = input<boolean>(true);
  readonly canMoveDown = input<boolean>(true);
  readonly jitter = input<boolean>(true);

  readonly download = output<void>();
  readonly remove = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly rename = output<string>();

  protected readonly editing = signal(false);
  protected readonly editValue = signal('');

  protected readonly label = computed(() => displayLabel(this.item()));

  private readonly i18n = inject(I18nService);

  protected readonly variant = computed<FileArtifactVariant>(() => {
    const it = this.item();
    const m = (it.mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'polaroid';
    if (m === 'application/pdf') return 'pdf-sheet';
    if (m.startsWith('audio/')) return 'cassette';
    if (m.startsWith('video/')) return 'vhs';
    if (m.startsWith('text/') || m === 'application/json') return 'thermal-receipt';
    if (
      m === 'application/zip' ||
      m === 'application/x-7z-compressed' ||
      m === 'application/x-rar-compressed' ||
      m === 'application/gzip' ||
      m === 'application/x-tar'
    )
      return 'envelope';
    const ext = extFromName(it.originalName, '');
    if (ext === 'pdf') return 'pdf-sheet';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'cassette';
    if (['mp4', 'mov', 'mkv', 'webm', 'avi'].includes(ext)) return 'vhs';
    if (['zip', '7z', 'rar', 'gz', 'tar'].includes(ext)) return 'envelope';
    if (['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'thermal-receipt';
    return 'postit';
  });

  protected readonly extLabel = computed(
    () => extFromName(this.item().originalName, '').toUpperCase() || 'BIN',
  );

  protected readonly sizeLabel = computed(() => formatBytes(this.item().bytes));

  protected readonly jitterStyle = computed(() => {
    if (!this.jitter()) return '';
    const h = hash(this.item().id);
    const rot = (((h & 0xff) / 255) * 4 - 2).toFixed(2);
    const tx = ((((h >> 8) & 0xff) / 255) * 8 - 4).toFixed(1);
    const ty = ((((h >> 16) & 0xff) / 255) * 8 - 4).toFixed(1);
    return `--mc-artifact-rot:${rot}deg;--mc-artifact-tx:${tx}px;--mc-artifact-ty:${ty}px;`;
  });

  protected readonly pinHue = computed(() => {
    const idx = hash(this.item().id + ':pin') % PIN_HUES.length;
    return PIN_HUES[idx] ?? PIN_HUES[0];
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onDownload(): void {
    this.download.emit();
  }
  protected onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit();
  }
  protected onMoveUp(event: MouseEvent): void {
    event.stopPropagation();
    this.moveUp.emit();
  }
  protected onMoveDown(event: MouseEvent): void {
    event.stopPropagation();
    this.moveDown.emit();
  }
  protected onStartRename(event: MouseEvent): void {
    event.stopPropagation();
    this.editValue.set(this.label());
    this.editing.set(true);
  }
  protected onRenameInput(event: Event): void {
    this.editValue.set((event.target as HTMLInputElement).value);
  }
  protected onRenameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editing.set(false);
    }
  }
  protected onRenameBlur(): void {
    if (this.editing()) this.commitRename();
  }
  private commitRename(): void {
    const next = this.editValue().trim();
    this.editing.set(false);
    if (next === this.label()) return;
    this.rename.emit(next);
  }
}
