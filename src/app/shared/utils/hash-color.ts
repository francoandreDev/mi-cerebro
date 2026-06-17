// why: hash determinístico para asignar color "personal" a una entidad
//      (lomos de libros, chips, etc) sin guardar el color en disco.
//      Mismo id → mismo color en cualquier sesión.

const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export interface HashColor {
  readonly bg: string;
  readonly fg: string;
}

export const hashColor = (seed: string): HashColor => {
  const h = hash(seed);
  const hue = h % 360;
  // why: saturación y luminosidad acotadas para que el lomo sea legible
  //      tanto en tema claro como oscuro sin testear caso por caso.
  const sat = 45 + (h % 25);
  const light = 28 + ((h >> 8) % 14);
  const bg = `hsl(${hue}deg ${sat}% ${light}%)`;
  const fg = `hsl(${hue}deg 30% 92%)`;
  return { bg, fg };
};
