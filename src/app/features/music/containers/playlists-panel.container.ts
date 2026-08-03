import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import type { PlaylistSummary } from '../models/music.types';
import { PlaylistsService } from '../services/playlists.service';
import { TRACK_DRAG_MIME } from './music.dnd';

// why: v2 originally hid playlists behind a modal; that buried the entry point.
// v12 polish exposes them as a second view of the left column (tab-toggled with
// the album library). Same data + create flow as the old modal, no backdrop or
// focus trap — the segmented control in the column header is the trigger.
@Component({
  selector: 'mc-playlists-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './playlists-panel.container.html',
  styleUrl: './playlists-panel.container.css',
})
export class PlaylistsPanelContainer {
  private readonly playlists = inject(PlaylistsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly player = inject(PlayerService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  readonly selected = output<PlaylistSummary>();

  protected readonly summaries = this.playlists.summaries;
  protected readonly currentSourceId = this.player.currentSourceId;
  protected readonly dragOverId = signal<string | null>(null);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSelect(summary: PlaylistSummary): void {
    this.selected.emit(summary);
  }

  protected onRowDragOver(id: string, event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(TRACK_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragOverId.set(id);
  }

  protected onRowDragLeave(id: string): void {
    if (this.dragOverId() === id) this.dragOverId.set(null);
  }

  protected async onRowDrop(id: string, event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOverId.set(null);
    const raw = event.dataTransfer?.getData(TRACK_DRAG_MIME);
    if (!raw) return;
    try {
      const trackIds = JSON.parse(raw) as unknown;
      if (!Array.isArray(trackIds) || trackIds.length === 0) return;
      await this.playlists.addTracks(id, trackIds);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onCreate(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const created = await this.playlists.create(this.t('music.newPlaylistTitle'));
      this.selected.emit({
        id: created.id,
        title: created.title,
        favorite: created.favorite === true,
        trackCount: created.trackIds.length,
        updatedAt: created.updatedAt,
        tags: created.tags,
      });
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
}
