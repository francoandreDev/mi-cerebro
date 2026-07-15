// Variant model (docs/proyecto/roadmap-13-versionado.md §19 13b). A variant is a "family" of three
// git branches: main / draft / comments. The Principal family is special:
// its main lives on the real `main` ref; other variants live under
// `variant/<slug>/{main,draft,comments}`.
//
// 13b-i scope: just the persisted shape and the helpers around it. The
// switch + index swap + cross-tab sync are 13b-ii.

export const VARIANTS_SCHEMA_VERSION = 2 as const;

export type VariantState = 'active' | 'dormant';

export interface VariantRefs {
  readonly main: string;
  readonly draft: string;
  readonly comments: string;
}

export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly protected: boolean;
  readonly lastActivityAt: number;
  readonly state: VariantState;
  readonly refs: VariantRefs;
  // why: 13b-i marks an entry pending-delete BEFORE touching git refs
  //      so a crash mid-delete leaves a recoverable state instead of
  //      orphan branches. `list()` retries on next load.
  readonly pendingDelete?: boolean;
  // why: schema v2. Lineage of the family so /variants can show "sale
  //      de X en abc1234". Principal has parentId=null and forkOid=null
  //      by definition. Variants migrated from v1 keep forkOid=null
  //      ("origen desconocido"); from v2 onwards create() records the
  //      parent main's OID at fork time.
  readonly parentId: string | null;
  readonly forkOid: string | null;
}

export interface VariantsFile {
  readonly schemaVersion: typeof VARIANTS_SCHEMA_VERSION;
  readonly activeId: string;
  readonly variants: readonly Variant[];
}

export const PRINCIPAL_VARIANT_ID = 'principal';

export const PRINCIPAL_REFS: VariantRefs = {
  main: 'main',
  draft: `variant/${PRINCIPAL_VARIANT_ID}/draft`,
  comments: `variant/${PRINCIPAL_VARIANT_ID}/comments`,
} as const;

export const DEFAULT_PRINCIPAL: Variant = {
  id: PRINCIPAL_VARIANT_ID,
  name: 'Principal',
  // why: --mc-accent-primary in dark theme; the picker in 13b-iii lets
  //      the user override. Kept literal here so the model is
  //      framework-independent.
  color: '#ff7a45',
  protected: true,
  lastActivityAt: 0,
  state: 'active',
  refs: PRINCIPAL_REFS,
  parentId: null,
  forkOid: null,
};

export const DEFAULT_VARIANTS_FILE: VariantsFile = {
  schemaVersion: VARIANTS_SCHEMA_VERSION,
  activeId: PRINCIPAL_VARIANT_ID,
  variants: [DEFAULT_PRINCIPAL],
} as const;

// Build the canonical refs for a non-principal variant from its slug.
export function refsForSlug(slug: string): VariantRefs {
  return {
    main: `variant/${slug}/main`,
    draft: `variant/${slug}/draft`,
    comments: `variant/${slug}/comments`,
  };
}

// Slug rules match those of milestones: lowercased ASCII letters,
// digits and hyphens. Git refnames forbid many ASCII chars, so we stay
// restrictive. Empty result means the input was unusable.
export function variantSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
