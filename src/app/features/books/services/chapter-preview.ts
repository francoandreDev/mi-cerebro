import type { ChapterPreview } from '../models/book.types';

const HEAD_CHARS = 140;
const TAIL_CHARS = 120;

// why: la mesa de lectura muestra "primer trozo … último trozo".
//      Cortamos en límite de palabra para no dejar tokens partidos
//      y devolvemos strings vacías si el body es corto/igual al head
//      (el componente decide si renderiza el tail).
export const buildChapterPreview = (plain: string): ChapterPreview => {
  const text = plain.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return { head: '', tail: '' };
  if (text.length <= HEAD_CHARS) return { head: text, tail: '' };
  const head = cutAtWord(text.slice(0, HEAD_CHARS), 'end');
  const tailRaw = text.slice(-TAIL_CHARS);
  const tail = cutAtWord(tailRaw, 'start');
  return { head, tail };
};

const cutAtWord = (slice: string, side: 'start' | 'end'): string => {
  if (side === 'end') {
    const lastSpace = slice.lastIndexOf(' ');
    return lastSpace > slice.length * 0.6 ? slice.slice(0, lastSpace) : slice;
  }
  const firstSpace = slice.indexOf(' ');
  return firstSpace > -1 && firstSpace < slice.length * 0.4 ? slice.slice(firstSpace + 1) : slice;
};
