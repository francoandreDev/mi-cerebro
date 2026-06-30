import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { IconComponent } from '@shared/icon/icon.component';

import { MusicLibraryService } from '../services/music-library.service';

// why: the queue lived inside NowPlaying in v1. v2 splits it into the right
// column. This container owns nothing new — just renders queue state from
// PlayerService so Fase 10 ("reubicación, no rewrite") is already done.
@Component({
  selector: 'mc-queue-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './queue-panel.container.html',
  styleUrl: './queue-panel.container.css',
})
export class QueuePanelContainer {
  private readonly player = inject(PlayerService);
  private readonly library = inject(MusicLibraryService);
  private readonly i18n = inject(I18nService);

  protected readonly isPlaying = this.player.isPlaying;
  protected readonly queue = this.player.queue;

  protected readonly queueTracks = computed(() => {
    const q = this.queue();
    const byId = new Map(this.library.tracks().map((t) => [t.id, t] as const));
    return q.trackIds
      .map((id, i) => {
        const t = byId.get(id);
        if (!t) return null;
        const title = (t.title?.trim() || t.originalName).trim();
        const artist = t.artist?.trim() ?? null;
        return { id: t.id, title, artist, isCurrent: i === q.index, index: i };
      })
      .filter(
        (
          x,
        ): x is {
          id: string;
          title: string;
          artist: string | null;
          isCurrent: boolean;
          index: number;
        } => x !== null,
      );
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onClearQueue(): void {
    this.player.stop();
  }

  protected async onJumpTo(index: number): Promise<void> {
    await this.player.jumpTo(index);
  }

  protected onRemoveFromQueue(index: number): void {
    this.player.removeAt(index);
  }
}
