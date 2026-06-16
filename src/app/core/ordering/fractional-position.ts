// Fractional indexing helper. Stores ordering as opaque base-62 strings whose
// lexicographic comparison matches the intended order. `between(a, b)` returns
// a new key strictly between `a` and `b`, allowing inserts at any position
// without renumbering. Convention: keys may not be empty, may not end with the
// MIN character ('0'), and must use only ALPHA characters — these invariants
// keep `between` total over any pair of valid keys with `a < b`.

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHA.length);
const MIN_CHAR = '0';

const invariant = (reason: string, context: Record<string, unknown> = {}): AppError =>
  new AppError(ERROR_CODES.SYS_003, { severity: 'fatal', context: { reason, ...context } });

const charAt = (i: number): string => {
  const c = ALPHA[i];
  if (c === undefined) throw invariant('position index out of range', { i });
  return c;
};

export const validate = (s: string): void => {
  if (s.length === 0) throw invariant('position cannot be empty');
  if (s.endsWith(MIN_CHAR)) throw invariant('position cannot end with MIN char', { s });
  for (const c of s) {
    if (ALPHA.indexOf(c) < 0) throw invariant('invalid position char', { c, s });
  }
};

const toBigInt = (s: string): bigint => {
  let n = 0n;
  for (const c of s) n = n * BASE + BigInt(ALPHA.indexOf(c));
  return n;
};

const fromBigInt = (n: bigint, length: number): string => {
  let value = n;
  let out = '';
  for (let i = 0; i < length; i++) {
    out = charAt(Number(value % BASE)) + out;
    value = value / BASE;
  }
  return out;
};

const padRight = (s: string, length: number): string =>
  s.length >= length ? s : s + MIN_CHAR.repeat(length - s.length);

const maxValue = (length: number): bigint => {
  let n = 0n;
  for (let i = 0; i < length; i++) n = n * BASE + (BASE - 1n);
  return n;
};

const stripTrailingMin = (s: string): string => {
  let end = s.length;
  while (end > 1 && s[end - 1] === MIN_CHAR) end--;
  return s.slice(0, end);
};

export const between = (a: string | null, b: string | null): string => {
  if (a !== null) validate(a);
  if (b !== null) validate(b);
  if (a !== null && b !== null && a >= b) {
    throw invariant('between requires a < b', { a, b });
  }
  const length = Math.max(a?.length ?? 0, b?.length ?? 0) + 1;
  const ai = a !== null ? toBigInt(padRight(a, length)) : 0n;
  const bi = b !== null ? toBigInt(padRight(b, length)) : maxValue(length);
  const mid = (ai + bi) / 2n;
  return stripTrailingMin(fromBigInt(mid, length));
};

export const initial = (): string => between(null, null);

export const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
