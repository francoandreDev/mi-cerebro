import type { BookSummary } from '@features/books/models/book.types';
import type { FileCollectionSummary } from '@features/files/models/file-collection.types';
import type { GoalSummary } from '@features/goals/models/goal.types';
import type { GallerySummary } from '@features/images/models/gallery.types';
import type { ListSummary } from '@features/lists/models/list.types';
import type { PlaylistSummary, Track } from '@features/music/models/music.types';
import type { NoteSummary } from '@features/notes/models/note.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import type { TaskSummary } from '@features/tasks/models/task.types';
import type { WritingSummary } from '@features/writings/models/writing.types';

// why: mirrors CalendarEvent's discriminated-union approach (core/calendar/
//      calendar-event.types.ts) but carries the full per-kind summary
//      instead of projecting to a flat shape — the tag detail view renders
//      each kind with its own native card, which needs kind-specific fields
//      (cover, preview, chapterCount, etc.) that a flat shape would drop.
export type TaggedItem =
  | { readonly kind: 'note'; readonly summary: NoteSummary }
  | { readonly kind: 'task'; readonly summary: TaskSummary }
  | { readonly kind: 'goal'; readonly summary: GoalSummary }
  | { readonly kind: 'list'; readonly summary: ListSummary }
  | { readonly kind: 'writing'; readonly summary: WritingSummary }
  | { readonly kind: 'book'; readonly summary: BookSummary }
  | { readonly kind: 'image'; readonly summary: GallerySummary }
  | { readonly kind: 'file'; readonly summary: FileCollectionSummary }
  | { readonly kind: 'track'; readonly summary: Track }
  | { readonly kind: 'playlist'; readonly summary: PlaylistSummary }
  | { readonly kind: 'reminder'; readonly summary: ReminderSummary };

export type TaggedItemKind = TaggedItem['kind'];
