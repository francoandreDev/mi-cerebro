import type { TranslationKey } from '@core/i18n/i18n.types';

import type { BucketId } from './history.types';

export const BUCKET_LABEL_KEY: Record<BucketId, TranslationKey> = {
  today: 'versioning.history.bucket.today',
  yesterday: 'versioning.history.bucket.yesterday',
  'this-week': 'versioning.history.bucket.thisWeek',
  'last-week': 'versioning.history.bucket.lastWeek',
  'two-weeks': 'versioning.history.bucket.twoWeeks',
  'one-month': 'versioning.history.bucket.oneMonth',
  older: 'versioning.history.bucket.older',
};
