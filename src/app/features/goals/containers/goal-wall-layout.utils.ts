// why: djb2 hash → posición estable por id sin guardar coordenadas.
export const hashStr = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

export const normTitle = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const constellationCenter = (goalId: string): { cx: number; cy: number } => {
  const h = hashStr(goalId);
  const a = h & 0xffff;
  const b = (h >>> 16) & 0xffff;
  // why: 18% padding por lado para que el cluster no clipee con bordes.
  return {
    cx: 18 + (a / 0xffff) * 64,
    cy: 18 + (b / 0xffff) * 64,
  };
};

export const stepOffset = (stepId: string, total: number): { dx: number; dy: number } => {
  const h = hashStr(stepId);
  const a = h & 0xffff;
  const b = (h >>> 16) & 0xffff;
  const angle = (a / 0xffff) * Math.PI * 2;
  // why: radio crece (suave) con cantidad de pasos para que clusters chicos
  //      sean compactos y los grandes ganen aire. Cap a ~12% del cielo.
  const rMax = 4 + Math.min(total, 8);
  const rMin = 2.5;
  const r = rMin + (b / 0xffff) * (rMax - rMin);
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
};

export const daysUntil = (deadline: string | null, todayIso: string): number | null => {
  if (!deadline) return null;
  const a = Date.parse(deadline + 'T00:00:00');
  const b = Date.parse(todayIso + 'T00:00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
};
