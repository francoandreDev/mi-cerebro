export type ChalkColorId = 'white' | 'yellow' | 'pink' | 'blue' | 'green';
export type ChalkSize = 's' | 'm' | 'l';
export type ChalkTool = 'chalk' | 'eraser';

export interface ChalkStroke {
  readonly id: string;
  readonly color: ChalkColorId;
  readonly size: ChalkSize;
  readonly points: readonly (readonly [number, number])[];
}

export interface ChalkLayer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly strokes: readonly ChalkStroke[];
}

export const CHALK_COLORS: readonly { id: ChalkColorId; hex: string }[] = [
  { id: 'white', hex: '#f1f5d8' },
  { id: 'yellow', hex: '#f5d36a' },
  { id: 'pink', hex: '#f08aa8' },
  { id: 'blue', hex: '#7cc1e6' },
  { id: 'green', hex: '#9fd07c' },
];

export const CHALK_SIZE_PX: Readonly<Record<ChalkSize, number>> = {
  s: 2.5,
  m: 5,
  l: 9,
};

export const ERASER_RADIUS_PX = 14;

export const newChalkLayer = (name: string): ChalkLayer => ({
  id: crypto.randomUUID(),
  name,
  visible: true,
  locked: false,
  strokes: [],
});
