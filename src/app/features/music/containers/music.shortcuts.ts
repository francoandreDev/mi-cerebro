import { DestroyRef, inject } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import type { ShortcutBinding } from '@core/shortcuts/shortcuts.types';

export interface MusicShortcutHandlers {
  readonly togglePlay: () => void;
  readonly newPlaylist: () => void;
  readonly focusSearch: () => void;
  readonly togglePlaylistsView: () => void;
}

export const registerMusicShortcuts = (handlers: MusicShortcutHandlers): void => {
  const shortcuts = inject(ShortcutsService);
  const destroyRef = inject(DestroyRef);
  const bindings: ShortcutBinding[] = [
    {
      combo: ' ',
      labelKey: 'music.shortcuts.playPause',
      scope: 'editable-safe',
      handler: handlers.togglePlay,
    },
    {
      combo: 'n',
      labelKey: 'music.shortcuts.newPlaylist',
      scope: 'editable-safe',
      handler: handlers.newPlaylist,
    },
    {
      combo: '/',
      labelKey: 'music.shortcuts.focusSearch',
      scope: 'editable-safe',
      handler: handlers.focusSearch,
    },
    {
      combo: 'p',
      labelKey: 'music.shortcuts.togglePlaylistsView',
      scope: 'editable-safe',
      handler: handlers.togglePlaylistsView,
    },
  ];
  const unsubs = bindings.map((b) => shortcuts.register(b));
  destroyRef.onDestroy(() => unsubs.forEach((u) => u()));
};
