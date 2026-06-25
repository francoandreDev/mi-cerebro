// why: SVG glyphs inline (mismo patrón que `shared/icon/icons.data.ts`)
//      en vez de assets en /public, para no agregar requests por íconos
//      de tamaño chico. El bloom usa `currentColor` para que la corola
//      pueda teñirse con el color del tag principal de la task.

export type PlantStage = 'seed' | 'sprout' | 'bloom';
export type HarvestedShape = 'bloom' | 'tree';

const SEED = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <ellipse cx="24" cy="34" rx="4" ry="2.5" fill="var(--mc-garden-soil-dirty)" opacity="0.7"/>
  <ellipse cx="24" cy="32" rx="2.6" ry="3.4" fill="var(--mc-garden-stem)" opacity="0.85"/>
</svg>`;

const SPROUT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <path d="M24 38 V20" stroke="var(--mc-garden-stem)" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M24 26 Q14 22 12 14 Q22 16 24 24" fill="var(--mc-garden-stem)" opacity="0.92"/>
  <path d="M24 22 Q34 18 36 10 Q26 12 24 20" fill="var(--mc-garden-stem)" opacity="0.92"/>
</svg>`;

const BLOOM = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <path d="M24 44 V24" stroke="var(--mc-garden-stem)" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M24 30 Q14 28 10 22 Q20 22 24 28" fill="var(--mc-garden-stem)" opacity="0.9"/>
  <path d="M24 30 Q34 28 38 22 Q28 22 24 28" fill="var(--mc-garden-stem)" opacity="0.9"/>
  <g transform="translate(24 16)">
    <ellipse cx="0" cy="-7" rx="5" ry="7" fill="currentColor"/>
    <ellipse cx="6.5" cy="-2" rx="5" ry="7" fill="currentColor" transform="rotate(60 6.5 -2)"/>
    <ellipse cx="4" cy="6" rx="5" ry="7" fill="currentColor" transform="rotate(120 4 6)"/>
    <ellipse cx="-4" cy="6" rx="5" ry="7" fill="currentColor" transform="rotate(60 -4 6)"/>
    <ellipse cx="-6.5" cy="-2" rx="5" ry="7" fill="currentColor" transform="rotate(120 -6.5 -2)"/>
    <circle cx="0" cy="0" r="2.4" fill="var(--mc-garden-planter-wood-fg)"/>
  </g>
</svg>`;

const WILTED = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <path d="M24 44 Q22 30 18 24" stroke="var(--mc-garden-stem)" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.8"/>
  <path d="M22 32 Q14 30 10 26 Q18 24 22 30" fill="var(--mc-garden-stem)" opacity="0.7"/>
  <g transform="translate(17 19)">
    <ellipse cx="0" cy="-6" rx="4" ry="6" fill="var(--mc-garden-petal-wilted)"/>
    <ellipse cx="5" cy="-1" rx="4" ry="6" fill="var(--mc-garden-petal-wilted)" transform="rotate(60 5 -1)"/>
    <ellipse cx="-5" cy="-1" rx="4" ry="6" fill="var(--mc-garden-petal-wilted)" transform="rotate(120 -5 -1)"/>
    <circle cx="0" cy="0" r="2" fill="var(--mc-garden-planter-wood-fg)"/>
  </g>
  <path d="M30 38 Q34 34 36 30" stroke="var(--mc-garden-petal-wilted)" stroke-width="1.6" fill="none" opacity="0.6"/>
</svg>`;

const TREE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <rect x="22" y="28" width="4" height="16" fill="var(--mc-garden-planter-wood-fg)"/>
  <ellipse cx="24" cy="20" rx="14" ry="12" fill="var(--mc-garden-leaf)"/>
  <ellipse cx="14" cy="24" rx="8" ry="7" fill="var(--mc-garden-leaf-shade)" opacity="0.95"/>
  <ellipse cx="34" cy="24" rx="8" ry="7" fill="var(--mc-garden-leaf-shade)" opacity="0.95"/>
  <ellipse cx="24" cy="14" rx="9" ry="8" fill="var(--mc-garden-leaf-hi)"/>
  <circle cx="18" cy="18" r="2" fill="currentColor"/>
  <circle cx="30" cy="22" r="2" fill="currentColor"/>
</svg>`;

export const PLANT_GLYPHS: Record<PlantStage | 'wilted' | 'tree', string> = {
  seed: SEED,
  sprout: SPROUT,
  bloom: BLOOM,
  wilted: WILTED,
  tree: TREE,
};
