export const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
};

export const countChars = (text: string): number => text.length;

// why: 200 wpm es promedio de lectura adulta en español. Devolvemos minutos enteros,
//      con mínimo 1 cuando hay texto, para no mostrar "0 min" en textos muy cortos.
export const readingMinutes = (words: number, wpm = 200): number => {
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / wpm));
};
