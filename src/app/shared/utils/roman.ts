// why: numeración de capítulos estilo libro. Capamos en 3999 (límite
//      clásico del romano); más allá devolvemos el arábigo crudo.

const MAP: readonly (readonly [number, string])[] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export const toRoman = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0 || n > 3999) return String(n);
  let acc = '';
  let rem = Math.floor(n);
  for (const [v, sym] of MAP) {
    while (rem >= v) {
      acc += sym;
      rem -= v;
    }
  }
  return acc;
};
