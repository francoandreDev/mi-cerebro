// Messenger paloma flight: a bird flies from its cage on /reminders to the
// rail icon, pecks it, and then either falls (one-shot) or perches at the
// bell waiting for the user to click its empty cage to recall it. There is
// no auto-return — the bird perches until the user calls it home.
//
// Path style is "wandering" — energetic and free, not acrobatic. The bird
// uses the whole stage and may briefly leave the viewport, then comes back
// to land. Built from a sum of lateral sinusoids on top of a straight line
// (the modes naturally vanish at endpoints).
//
// Public surface:
//   launchPaloma(reminder)            — spawn a bird & fly to the rail icon
//   recallPaloma(reminderId): boolean — fly a perched bird home; true if one

import type { ReminderSummary } from '../models/reminder.types';

interface Waypoint {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}
interface FlightPath {
  readonly samples: readonly Waypoint[];
  readonly fromR: number;
  readonly toR: number;
}
interface PerchedBird {
  readonly fly: HTMLElement;
  readonly styleEl: HTMLStyleElement;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly fate: 'return' | 'die';
}

// Bird is 80×60.
const HALF_W = 40;
const HALF_H = 30;
// Sync with SCSS $mc-paloma-* constants.
const FLY_DUR = 6.72;
const PECK_DUR = 0.55;
const PECKS = 3;
const RETURN_DUR = 4.2;
const DIE_DUR = 1.6;

const PERCHED = new Map<string, PerchedBird>();

const FLYING_PALOMA_SVG = `
<div class="paloma-bob">
  <svg viewBox="0 0 80 60" aria-hidden="true">
    <polygon class="tail" points="22,38 4,30 4,46"/>
    <ellipse class="body" cx="42" cy="38" rx="17" ry="8"/>
    <path class="wing-down" d="M 44 32 Q 28 52 4 44 Q 24 38 44 32 Z"/>
    <path class="wing-up" d="M 44 32 Q 26 6 4 16 Q 22 26 44 32 Z"/>
    <circle class="head" cx="58" cy="28" r="7"/>
    <polygon class="beak" points="65,28 73,27 65,31"/>
    <circle class="eye" cx="60" cy="26" r="1.2"/>
    <rect class="paper" x="64" y="30" width="11" height="5" rx="1.2"/>
  </svg>
</div>`;

const cssEscape = (s: string): string =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');

const onceAnimationEnd = (el: HTMLElement, name: string): Promise<void> =>
  new Promise((resolve) => {
    const handler = (e: Event): void => {
      if ((e as AnimationEvent).animationName !== name) return;
      el.removeEventListener('animationend', handler);
      resolve();
    };
    el.addEventListener('animationend', handler);
  });

export const launchPaloma = (reminder: ReminderSummary): void => {
  if (typeof document === 'undefined') return;
  const target = document.querySelector<HTMLElement>('.rail-btn.reminders');
  if (!target) return;
  // why: same reminder firing again while its previous bird still perches
  //      would orphan the perched element; clear it first.
  const stale = PERCHED.get(reminder.id);
  if (stale) {
    stale.fly.remove();
    stale.styleEl.remove();
    PERCHED.delete(reminder.id);
  }
  const dst = target.getBoundingClientRect();
  const cage = document.querySelector<HTMLElement>(`[data-paloma-id="${cssEscape(reminder.id)}"]`);
  const src = cage?.getBoundingClientRect();
  const jitter = (range: number): number => (Math.random() * 2 - 1) * range;
  const fromX = src ? src.left + src.width / 2 - HALF_W + jitter(4) : window.innerWidth + 80;
  const fromY = src
    ? src.top + src.height / 2 - HALF_H + jitter(4)
    : dst.top + dst.height / 2 - HALF_H + jitter(50);
  const toX = dst.left + dst.width / 2 - HALF_W;
  const toY = dst.top + dst.height / 2 - HALF_H;
  const willReturn = reminder.recurrence !== null && !reminder.paused;
  void runFlight(reminder.id, fromX, fromY, toX, toY, willReturn);
};

export const recallPaloma = (reminderId: string): boolean => {
  const bird = PERCHED.get(reminderId);
  if (!bird) return false;
  PERCHED.delete(reminderId);
  void runRecall(bird);
  return true;
};

const runFlight = async (
  reminderId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  willReturn: boolean,
): Promise<void> => {
  const out = buildWanderPath(fromX, fromY, toX, toY, 50, 'tangent', 'nearest-360');
  const flightId = Math.random().toString(36).slice(2, 10);
  const flyKfName = `mc-paloma-fly-${flightId}`;
  const styleEl = document.createElement('style');
  styleEl.textContent = keyframesFor(flyKfName, fromX, fromY, toX, toY, out);
  document.head.appendChild(styleEl);

  const fly = document.createElement('div');
  fly.className = 'mc-flying-paloma';
  fly.dataset['fate'] = willReturn ? 'return' : 'die';
  fly.style.setProperty('--to-x', `${toX}px`);
  fly.style.setProperty('--to-y', `${toY}px`);
  fly.style.transform = `translate(${fromX}px, ${fromY}px) rotate(${out.fromR}deg)`;
  fly.innerHTML = FLYING_PALOMA_SVG;
  document.body.appendChild(fly);

  fly.style.animation = `${flyKfName} ${FLY_DUR}s linear forwards`;
  await onceAnimationEnd(fly, flyKfName);

  // Pin to bell so the inline transform survives switching the animation
  // property (no 'forwards' on peck, so removing it would otherwise snap
  // back to the cage origin).
  fly.style.transform = `translate(${toX}px, ${toY}px) rotate(0deg)`;
  fly.style.animation = `mc-paloma-peck-kf ${PECK_DUR}s ease-in-out ${PECKS}`;
  await onceAnimationEnd(fly, 'mc-paloma-peck-kf');

  if (willReturn) {
    // Bird perches and waits for recall. Bob/wings keep running on inner
    // elements; the outer `.mc-flying-paloma` is now still.
    fly.style.animation = '';
    PERCHED.set(reminderId, { fly, styleEl, fromX, fromY, toX, toY, fate: 'return' });
    return;
  }

  fly.style.animation = `mc-paloma-die-kf ${DIE_DUR}s cubic-bezier(0.5, 0.05, 0.7, 0.5) forwards, mc-paloma-final 0.001s ${DIE_DUR}s forwards`;
  await onceAnimationEnd(fly, 'mc-paloma-final');
  fly.remove();
  styleEl.remove();
};

const runRecall = async (bird: PerchedBird): Promise<void> => {
  const { fly, styleEl, fromX, fromY, toX, toY } = bird;
  // Recall = wander home. Same energetic spirit as the outbound flight.
  // Rotation starts at 0 (where peck left it) and blends to the tangent so
  // takeoff reads as the bird turning around in flight.
  const path = buildWanderPath(toX, toY, fromX, fromY, 40, 'zero-blend', 'tangent');
  const recallId = Math.random().toString(36).slice(2, 10);
  const kfName = `mc-paloma-recall-${recallId}`;
  const recallStyle = document.createElement('style');
  recallStyle.textContent = keyframesFor(kfName, toX, toY, fromX, fromY, path);
  document.head.appendChild(recallStyle);
  fly.style.animation = `${kfName} ${RETURN_DUR}s ease-in-out forwards`;
  await onceAnimationEnd(fly, kfName);
  fly.remove();
  styleEl.remove();
  recallStyle.remove();
};

const keyframesFor = (
  name: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  path: FlightPath,
): string => {
  const stops: { x: number; y: number; r: number }[] = [
    { x: fromX, y: fromY, r: path.fromR },
    ...path.samples,
    { x: toX, y: toY, r: path.toR },
  ];
  const lines = stops
    .map((s, i) => {
      const pct = ((i / (stops.length - 1)) * 100).toFixed(3);
      return `${pct}% { transform: translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.r.toFixed(2)}deg); }`;
    })
    .join('\n  ');
  return `@keyframes ${name} {\n  ${lines}\n}`;
};

// Wandering path: straight-line base + sum of three lateral sinusoids
// with random signed amplitudes (the modes vanish at t=0/1, pinning the
// endpoints). Amplitudes scale to the viewport so the bird uses the whole
// stage and can briefly overshoot it — that's the "ansiando libertad".
// startRot 'zero-blend' blends from 0 to tangent over first 18% (used on
// recall, where peck left the bird at rotation 0). endRot 'nearest-360'
// bends final 12% to the nearest 360° multiple so peck's rotate(0) snaps
// invisibly.
const buildWanderPath = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  N: number,
  startRot: 'tangent' | 'zero-blend',
  endRot: 'tangent' | 'nearest-360',
): FlightPath => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const rand = (a: number, b: number): number => a + Math.random() * (b - a);
  // Amplitudes scale with viewport so the swing is dramatic — the bird
  // uses the screen instead of skimming the line between cage and bell.
  const scale = Math.min(vw, vh);
  const a1 = rand(-1, 1) * scale * 0.55; // primary swing — can take it offscreen
  const a2 = rand(-1, 1) * scale * 0.28;
  const a3 = rand(-1, 1) * scale * 0.14;

  const posAt = (t: number): { x: number; y: number } => {
    const lateral =
      a1 * Math.sin(Math.PI * t) + a2 * Math.sin(2 * Math.PI * t) + a3 * Math.sin(3 * Math.PI * t);
    return {
      x: fromX + dx * t + px * lateral,
      y: fromY + dy * t + py * lateral,
    };
  };

  const eps = 0.012;
  const headingAt = (t: number): number => {
    const a = posAt(Math.max(0, t - eps));
    const b = posAt(Math.min(1, t + eps));
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };

  let prevR = headingAt(0);
  const unwrap = (r: number): number => {
    while (r - prevR > 180) r -= 360;
    while (r - prevR < -180) r += 360;
    prevR = r;
    return r;
  };

  const tangentFromR = prevR;
  const raw: Waypoint[] = [];
  for (let i = 1; i <= N; i++) {
    const t = i / (N + 1);
    const p = posAt(t);
    raw.push({ x: p.x, y: p.y, r: unwrap(headingAt(t)) });
  }
  let toR = unwrap(headingAt(1));

  // End rotation handling.
  if (endRot === 'nearest-360') {
    const target = Math.round(toR / 360) * 360;
    for (let i = 0; i < raw.length; i++) {
      const t = (i + 1) / (N + 1);
      if (t <= 0.88) continue;
      const blend = (t - 0.88) / 0.12;
      const s = raw[i]!;
      raw[i] = { x: s.x, y: s.y, r: s.r + (target - s.r) * blend };
    }
    toR = target;
  }

  // Start rotation handling.
  let fromR = tangentFromR;
  if (startRot === 'zero-blend') {
    fromR = 0;
    const blendIn = 0.18;
    for (let i = 0; i < raw.length; i++) {
      const t = (i + 1) / (N + 1);
      if (t >= blendIn) break;
      const blend = t / blendIn;
      const s = raw[i]!;
      raw[i] = { x: s.x, y: s.y, r: s.r * blend };
    }
  }

  return { samples: raw, fromR, toR };
};
