import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';

import type { Playlist, Track } from '../models/music.types';
import { MusicLibraryService } from '../services/music-library.service';
import { PlaylistsService } from '../services/playlists.service';

@Component({
  selector: 'mc-playlist-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent],
  templateUrl: './playlist-editor.container.html',
  styleUrl: './playlist-editor.container.css',
})
export class PlaylistEditorContainer {
  private readonly library = inject(MusicLibraryService);
  private readonly playlists = inject(PlaylistsService);
  private readonly player = inject(PlayerService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  private readonly playlistSignal = signal<Playlist | null>(null);

  @Input({ required: true }) set playlist(value: Playlist) {
    this.playlistSignal.set(value);
  }

  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly changed = new EventEmitter<Playlist>();
  @Output() readonly deleted = new EventEmitter<string>();

  protected readonly current = this.playlistSignal.asReadonly();
  protected readonly currentTrackId = this.player.currentTrackId;
  protected readonly isPlaying = this.player.isPlaying;
  protected readonly picking = signal(false);
  protected readonly pickerQuery = signal('');
  protected readonly dragOverIdx = signal<number | null>(null);
  protected readonly confirm = new ConfirmController();

  protected readonly tracks = this.library.tracks;

  protected readonly activeTracks = computed<readonly Track[]>(() => {
    const pl = this.current();
    if (!pl) return [];
    const byId = new Map(this.tracks().map((t) => [t.id, t] as const));
    return pl.trackIds.map((id) => byId.get(id)).filter((t): t is Track => t !== undefined);
  });

  protected readonly availableForActive = computed<readonly Track[]>(() => {
    const pl = this.current();
    if (!pl) return [];
    const inUse = new Set(pl.trackIds);
    return this.tracks().filter((t) => !inUse.has(t.id));
  });

  protected readonly pickerResults = computed<readonly Track[]>(() => {
    const q = this.pickerQuery().trim().toLowerCase();
    const all = this.availableForActive();
    if (q.length === 0) return all;
    return all.filter((t) => t.originalName.toLowerCase().includes(q));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onBack(): void {
    this.back.emit();
    this.picking.set(false);
    this.pickerQuery.set('');
  }

  protected onTitleInput(value: string): void {
    void this.savePatch({ title: value });
  }

  protected async onToggleFavorite(): Promise<void> {
    const pl = this.current();
    if (!pl) return;
    await this.savePatch({ favorite: !(pl.favorite === true) });
  }

  protected async onPlayPlaylist(): Promise<void> {
    const pl = this.current();
    if (!pl || pl.trackIds.length === 0) return;
    await this.player.playPlaylist(pl.trackIds, 0, pl.id);
  }

  protected async onShufflePlaylist(): Promise<void> {
    const pl = this.current();
    if (!pl || pl.trackIds.length === 0) return;
    await this.player.playPlaylist(pl.trackIds, 0, pl.id, true);
  }

  protected onDelete(): void {
    const pl = this.current();
    if (!pl) return;
    this.confirm.ask(
      {
        title: this.t('music.confirm.deletePlaylist.title'),
        message: this.t('music.deletePlaylistConfirm').replace('{title}', pl.title || '—'),
        confirmLabel: this.t('music.confirm.deletePlaylist.confirm'),
        cancelLabel: this.t('music.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.playlists.delete(pl.id);
          this.deleted.emit(pl.id);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected async onPlayTrack(track: Track): Promise<void> {
    if (this.currentTrackId() === track.id) {
      await this.player.toggle();
      return;
    }
    await this.player.playTrack(track.id);
  }

  protected async onRemove(trackId: string): Promise<void> {
    const pl = this.current();
    if (!pl) return;
    await this.savePatch({ trackIds: pl.trackIds.filter((id) => id !== trackId) });
  }

  protected onTrackDragStart(idx: number, event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(REORDER_MIME, String(idx));
    event.dataTransfer.effectAllowed = 'move';
  }

  protected onTrackDragOver(idx: number, event: DragEvent): void {
    if (!event.dataTransfer || !hasReorder(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    this.dragOverIdx.set(idx);
  }

  protected onTrackDragLeave(): void {
    this.dragOverIdx.set(null);
  }

  protected async onTrackDrop(targetIdx: number, event: DragEvent): Promise<void> {
    this.dragOverIdx.set(null);
    if (!hasReorder(event)) return;
    event.preventDefault();
    const src = Number.parseInt(event.dataTransfer?.getData(REORDER_MIME) ?? '', 10);
    if (Number.isNaN(src) || src === targetIdx) return;
    const pl = this.current();
    if (!pl) return;
    const reordered = reorderIds(pl.trackIds, src, targetIdx);
    if (reordered === null) return;
    await this.savePatch({ trackIds: reordered });
  }

  protected togglePicker(): void {
    this.picking.update((v) => !v);
    if (!this.picking()) this.pickerQuery.set('');
  }

  protected async onAdd(track: Track): Promise<void> {
    const pl = this.current();
    if (!pl || pl.trackIds.includes(track.id)) return;
    await this.savePatch({ trackIds: [...pl.trackIds, track.id] });
  }

  protected onPickerQueryInput(value: string): void {
    this.pickerQuery.set(value);
  }

  protected asInput(target: EventTarget | null): HTMLInputElement {
    return target as HTMLInputElement;
  }

  private async savePatch(patch: Partial<Playlist>): Promise<Playlist | null> {
    const pl = this.current();
    if (!pl) return null;
    try {
      const updated = await this.playlists.save({ ...pl, ...patch });
      this.playlistSignal.set(updated);
      this.changed.emit(updated);
      return updated;
    } catch (e) {
      this.errors.report(e);
      return null;
    }
  }
}

const REORDER_MIME = 'application/x-mc-playlist-reorder';

function hasReorder(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === REORDER_MIME) return true;
  return false;
}

function reorderIds(ids: readonly string[], src: number, target: number): readonly string[] | null {
  if (src < 0 || src >= ids.length) return null;
  const next = [...ids];
  const moved = next.splice(src, 1)[0];
  if (moved === undefined) return null;
  next.splice(target, 0, moved);
  return next;
}
