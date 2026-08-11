import type { TranslationKey } from '@core/i18n/i18n.types';
import type { IconName } from '@shared/icon/icons.data';

export interface HomeCard {
  readonly key: string;
  readonly route: string;
  readonly icon: IconName;
  readonly title: TranslationKey;
  readonly purpose: TranslationKey;
  readonly steps: readonly TranslationKey[];
}

export interface HomeGroup {
  readonly key: 'entities' | 'transversal' | 'help';
  readonly title: TranslationKey;
  readonly cards: readonly HomeCard[];
}

export interface HomeWorkflow {
  readonly key: string;
  readonly icon: IconName;
  readonly title: TranslationKey;
  readonly description: TranslationKey;
  readonly steps: readonly TranslationKey[];
}

export const HOME_WORKFLOWS_TODAY: readonly HomeWorkflow[] = [
  {
    key: 'capture',
    icon: 'sparkle',
    title: 'home.flow.capture.title',
    description: 'home.flow.capture.description',
    steps: [
      'home.flow.capture.step.1',
      'home.flow.capture.step.2',
      'home.flow.capture.step.3',
      'home.flow.capture.step.4',
    ],
  },
  {
    key: 'project',
    icon: 'target',
    title: 'home.flow.project.title',
    description: 'home.flow.project.description',
    steps: [
      'home.flow.project.step.1',
      'home.flow.project.step.2',
      'home.flow.project.step.3',
      'home.flow.project.step.4',
    ],
  },
  {
    key: 'writing',
    icon: 'pen-nib',
    title: 'home.flow.writing.title',
    description: 'home.flow.writing.description',
    steps: [
      'home.flow.writing.step.1',
      'home.flow.writing.step.2',
      'home.flow.writing.step.3',
      'home.flow.writing.step.4',
      'home.flow.writing.step.5',
    ],
  },
  {
    key: 'daily',
    icon: 'calendar-dots',
    title: 'home.flow.daily.title',
    description: 'home.flow.daily.description',
    steps: [
      'home.flow.daily.step.1',
      'home.flow.daily.step.2',
      'home.flow.daily.step.3',
      'home.flow.daily.step.4',
    ],
  },
  {
    key: 'tagview',
    icon: 'magnifying-glass',
    title: 'home.flow.tagview.title',
    description: 'home.flow.tagview.description',
    steps: ['home.flow.tagview.step.1', 'home.flow.tagview.step.2', 'home.flow.tagview.step.3'],
  },
  {
    key: 'study',
    icon: 'books',
    title: 'home.flow.study.title',
    description: 'home.flow.study.description',
    steps: [
      'home.flow.study.step.1',
      'home.flow.study.step.2',
      'home.flow.study.step.3',
      'home.flow.study.step.4',
    ],
  },
];

// why: no queda ningún flujo prometido sin cablear — quick-capture global
//      (Alt+Shift+N) cerró la única pieza que faltaba para "study". Se
//      mantiene el array (en vez de borrarlo) para que la próxima promesa
//      sin cablear tenga dónde caer sin reinventar el patrón.
export const HOME_WORKFLOWS_FUTURE: readonly HomeWorkflow[] = [];

const ENTITY_STEPS = (key: string, count: number): readonly TranslationKey[] =>
  Array.from({ length: count }, (_, i) => `home.entity.${key}.step.${i + 1}` as TranslationKey);

export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    key: 'entities',
    title: 'home.group.entities',
    cards: [
      {
        key: 'notes',
        route: '/notes',
        icon: 'note',
        title: 'tree.type.notes',
        purpose: 'home.entity.notes.purpose',
        steps: ENTITY_STEPS('notes', 4),
      },
      {
        key: 'tasks',
        route: '/tasks',
        icon: 'check-square',
        title: 'tree.type.tasks',
        purpose: 'home.entity.tasks.purpose',
        steps: ENTITY_STEPS('tasks', 4),
      },
      {
        key: 'goals',
        route: '/goals',
        icon: 'target',
        title: 'tree.type.goals',
        purpose: 'home.entity.goals.purpose',
        steps: ENTITY_STEPS('goals', 3),
      },
      {
        key: 'lists',
        route: '/lists',
        icon: 'list-bullets',
        title: 'tree.type.lists',
        purpose: 'home.entity.lists.purpose',
        steps: ENTITY_STEPS('lists', 4),
      },
      {
        key: 'writings',
        route: '/writings',
        icon: 'pen-nib',
        title: 'tree.type.writings',
        purpose: 'home.entity.writings.purpose',
        steps: ENTITY_STEPS('writings', 4),
      },
      {
        key: 'books',
        route: '/books',
        icon: 'books',
        title: 'tree.type.books',
        purpose: 'home.entity.books.purpose',
        steps: ENTITY_STEPS('books', 4),
      },
      {
        key: 'images',
        route: '/images',
        icon: 'image',
        title: 'tree.type.images',
        purpose: 'home.entity.images.purpose',
        steps: ENTITY_STEPS('images', 3),
      },
      {
        key: 'files',
        route: '/files',
        icon: 'paperclip',
        title: 'tree.type.files',
        purpose: 'home.entity.files.purpose',
        steps: ENTITY_STEPS('files', 3),
      },
      {
        key: 'music',
        route: '/music',
        icon: 'music-notes',
        title: 'music.title',
        purpose: 'home.entity.music.purpose',
        steps: ENTITY_STEPS('music', 4),
      },
      {
        key: 'calendar',
        route: '/calendar',
        icon: 'calendar-dots',
        title: 'calendar.title',
        purpose: 'home.entity.calendar.purpose',
        steps: ENTITY_STEPS('calendar', 3),
      },
      {
        key: 'reminders',
        route: '/reminders',
        icon: 'bell',
        title: 'reminders.title',
        purpose: 'home.entity.reminders.purpose',
        steps: ENTITY_STEPS('reminders', 3),
      },
    ],
  },
  {
    key: 'transversal',
    title: 'home.group.transversal',
    cards: [
      {
        key: 'search',
        route: '/notes',
        icon: 'magnifying-glass',
        title: 'home.entity.search.title',
        purpose: 'home.entity.search.purpose',
        steps: ENTITY_STEPS('search', 4),
      },
      {
        key: 'history',
        route: '/history',
        icon: 'clock-counter-clockwise',
        title: 'versioning.history.title',
        purpose: 'home.entity.history.purpose',
        steps: ENTITY_STEPS('history', 4),
      },
      {
        key: 'variants',
        route: '/variants',
        icon: 'git-branch',
        title: 'variants.page.title',
        purpose: 'home.entity.variants.purpose',
        steps: ENTITY_STEPS('variants', 4),
      },
      {
        key: 'trash',
        route: '/trash',
        icon: 'trash',
        title: 'trash.title',
        purpose: 'home.entity.trash.purpose',
        steps: ENTITY_STEPS('trash', 3),
      },
      {
        key: 'sync',
        route: '/sync',
        icon: 'arrows-clockwise',
        title: 'home.entity.sync.title',
        purpose: 'home.entity.sync.purpose',
        steps: ENTITY_STEPS('sync', 4),
      },
    ],
  },
  {
    key: 'help',
    title: 'home.group.help',
    cards: [
      {
        key: 'settings',
        route: '/settings',
        icon: 'gear',
        title: 'settings.title',
        purpose: 'home.entity.settings.purpose',
        steps: ENTITY_STEPS('settings', 3),
      },
      {
        key: 'shortcuts',
        route: '/notes',
        icon: 'keyboard',
        title: 'home.entity.shortcuts.title',
        purpose: 'home.entity.shortcuts.purpose',
        steps: ENTITY_STEPS('shortcuts', 3),
      },
    ],
  },
];
