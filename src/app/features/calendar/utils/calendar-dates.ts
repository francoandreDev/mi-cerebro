export const pad2 = (n: number): string => n.toString().padStart(2, '0');

export const formatIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseIsoDay = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const todayIso = (): string => formatIsoDay(new Date());

export const startOfMonth = (year: number, month: number): Date => new Date(year, month, 1);

export const endOfMonth = (year: number, month: number): Date => new Date(year, month + 1, 0);

export const addMonths = (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } => {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export interface MonthDay {
  readonly iso: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly isWeekend: boolean;
}

// why: returns a Mon..Sun grid of 6 weeks (42 cells) so the layout never
//      jumps shape; cells outside the current month are flagged inMonth=false.
export const buildMonthGrid = (year: number, month: number): readonly MonthDay[] => {
  const first = startOfMonth(year, month);
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dow);
  const cells: MonthDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const day = d.getDay();
    cells.push({
      iso: formatIsoDay(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isWeekend: day === 0 || day === 6,
    });
  }
  return cells;
};

export const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const WEEKDAY_SHORT_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export const formatDayMonth = (iso: string): string => {
  const d = parseIsoDay(iso);
  if (!d) return iso;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};
