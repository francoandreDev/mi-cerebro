// Catalog of error codes. Every entry MUST also exist in docs/errors.md
// with its diagnosis and recovery (rule 26).
//
// Format: MCB-<area>-<###>. Areas in PROYECTO.md §6.

import type { TranslationKey } from '@core/i18n/i18n.types';

export const ERROR_CODES = {
  SYS_001: 'MCB-SYS-001',
  SYS_002: 'MCB-SYS-002',
  FS_001: 'MCB-FS-001',
  FS_002: 'MCB-FS-002',
  FS_003: 'MCB-FS-003',
  FS_004: 'MCB-FS-004',
  AUT_001: 'MCB-AUT-001',
  AUT_002: 'MCB-AUT-002',
  AUT_005: 'MCB-AUT-005',
  AUT_006: 'MCB-AUT-006',
  IDB_001: 'MCB-IDB-001',
  IDB_002: 'MCB-IDB-002',
  MIG_001: 'MCB-MIG-001',
  MIG_002: 'MCB-MIG-002',
  ENT_001: 'MCB-ENT-001',
  ENT_002: 'MCB-ENT-002',
  VER_001: 'MCB-VER-001',
  VER_002: 'MCB-VER-002',
  VER_003: 'MCB-VER-003',
  VER_004: 'MCB-VER-004',
  VER_005: 'MCB-VER-005',
  VER_006: 'MCB-VER-006',
  VER_007: 'MCB-VER-007',
  VER_008: 'MCB-VER-008',
  VER_009: 'MCB-VER-009',
  VER_010: 'MCB-VER-010',
  VER_011: 'MCB-VER-011',
  VER_012: 'MCB-VER-012',
  VER_017: 'MCB-VER-017',
  VER_018: 'MCB-VER-018',
  VER_019: 'MCB-VER-019',
  VER_020: 'MCB-VER-020',
  VER_021: 'MCB-VER-021',
  VER_022: 'MCB-VER-022',
  VER_023: 'MCB-VER-023',
  VER_024: 'MCB-VER-024',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

interface CodeMeta {
  readonly titleKey: TranslationKey;
  readonly messageKey: TranslationKey;
}

export const ERROR_CODE_META: Record<ErrorCode, CodeMeta> = {
  'MCB-SYS-001': { titleKey: 'errors.sys.001.title', messageKey: 'errors.sys.001.message' },
  'MCB-SYS-002': { titleKey: 'errors.sys.002.title', messageKey: 'errors.sys.002.message' },
  'MCB-FS-001': { titleKey: 'errors.fs.001.title', messageKey: 'errors.fs.001.message' },
  'MCB-FS-002': { titleKey: 'errors.fs.002.title', messageKey: 'errors.fs.002.message' },
  'MCB-FS-003': { titleKey: 'errors.fs.003.title', messageKey: 'errors.fs.003.message' },
  'MCB-FS-004': { titleKey: 'errors.fs.004.title', messageKey: 'errors.fs.004.message' },
  'MCB-AUT-001': { titleKey: 'errors.aut.001.title', messageKey: 'errors.aut.001.message' },
  'MCB-AUT-002': { titleKey: 'errors.aut.002.title', messageKey: 'errors.aut.002.message' },
  'MCB-AUT-005': { titleKey: 'errors.aut.005.title', messageKey: 'errors.aut.005.message' },
  'MCB-AUT-006': { titleKey: 'errors.aut.006.title', messageKey: 'errors.aut.006.message' },
  'MCB-IDB-001': { titleKey: 'errors.idb.001.title', messageKey: 'errors.idb.001.message' },
  'MCB-IDB-002': { titleKey: 'errors.idb.002.title', messageKey: 'errors.idb.002.message' },
  'MCB-MIG-001': { titleKey: 'errors.mig.001.title', messageKey: 'errors.mig.001.message' },
  'MCB-MIG-002': { titleKey: 'errors.mig.002.title', messageKey: 'errors.mig.002.message' },
  'MCB-ENT-001': { titleKey: 'errors.ent.001.title', messageKey: 'errors.ent.001.message' },
  'MCB-ENT-002': { titleKey: 'errors.ent.002.title', messageKey: 'errors.ent.002.message' },
  'MCB-VER-001': { titleKey: 'errors.ver.001.title', messageKey: 'errors.ver.001.message' },
  'MCB-VER-002': { titleKey: 'errors.ver.002.title', messageKey: 'errors.ver.002.message' },
  'MCB-VER-003': { titleKey: 'errors.ver.003.title', messageKey: 'errors.ver.003.message' },
  'MCB-VER-004': { titleKey: 'errors.ver.004.title', messageKey: 'errors.ver.004.message' },
  'MCB-VER-005': { titleKey: 'errors.ver.005.title', messageKey: 'errors.ver.005.message' },
  'MCB-VER-006': { titleKey: 'errors.ver.006.title', messageKey: 'errors.ver.006.message' },
  'MCB-VER-007': { titleKey: 'errors.ver.007.title', messageKey: 'errors.ver.007.message' },
  'MCB-VER-008': { titleKey: 'errors.ver.008.title', messageKey: 'errors.ver.008.message' },
  'MCB-VER-009': { titleKey: 'errors.ver.009.title', messageKey: 'errors.ver.009.message' },
  'MCB-VER-010': { titleKey: 'errors.ver.010.title', messageKey: 'errors.ver.010.message' },
  'MCB-VER-011': { titleKey: 'errors.ver.011.title', messageKey: 'errors.ver.011.message' },
  'MCB-VER-012': { titleKey: 'errors.ver.012.title', messageKey: 'errors.ver.012.message' },
  'MCB-VER-017': { titleKey: 'errors.ver.017.title', messageKey: 'errors.ver.017.message' },
  'MCB-VER-018': { titleKey: 'errors.ver.018.title', messageKey: 'errors.ver.018.message' },
  'MCB-VER-019': { titleKey: 'errors.ver.019.title', messageKey: 'errors.ver.019.message' },
  'MCB-VER-020': { titleKey: 'errors.ver.020.title', messageKey: 'errors.ver.020.message' },
  'MCB-VER-021': { titleKey: 'errors.ver.021.title', messageKey: 'errors.ver.021.message' },
  'MCB-VER-022': { titleKey: 'errors.ver.022.title', messageKey: 'errors.ver.022.message' },
  'MCB-VER-023': { titleKey: 'errors.ver.023.title', messageKey: 'errors.ver.023.message' },
  'MCB-VER-024': { titleKey: 'errors.ver.024.title', messageKey: 'errors.ver.024.message' },
};
