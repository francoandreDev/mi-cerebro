import { describe, expect, it, vi } from 'vitest';

import { createDndController } from './dnd-controller';
import { MC_INTERNAL_DND_TYPE } from './dnd';

const makeDataTransfer = (): DataTransfer => {
  const store = new Map<string, string>();
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
    effectAllowed: 'none',
    dropEffect: 'none',
  } as unknown as DataTransfer;
};

const makeEvent = (): DragEvent => {
  const dataTransfer = makeDataTransfer();
  return { dataTransfer, preventDefault: vi.fn() } as unknown as DragEvent;
};

describe('createDndController', () => {
  it('writes the internal mime + text fallback + effectAllowed on start', () => {
    const c = createDndController();
    const ev = makeEvent();
    c.onDragStart(ev, 'task-1');
    expect(ev.dataTransfer!.getData(MC_INTERNAL_DND_TYPE)).toBe('task-1');
    expect(ev.dataTransfer!.getData('text/plain')).toBe('task-1');
    expect(ev.dataTransfer!.effectAllowed).toBe('move');
    expect(c.draggingId()).toBe('task-1');
  });

  it('is a noop when dataTransfer is missing', () => {
    const c = createDndController();
    c.onDragStart({ dataTransfer: null } as unknown as DragEvent, 'x');
    expect(c.draggingId()).toBeNull();
  });

  it('preventDefaults dragover and sets dropEffect', () => {
    const c = createDndController();
    const ev = makeEvent();
    c.onDragOver(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ev.dataTransfer!.dropEffect).toBe('move');
  });

  it('keeps overZone steady while children fire enter/leave (depth counter)', () => {
    const c = createDndController<'today' | 'week'>();
    c.onDragEnter('today'); // zone
    c.onDragEnter('today'); // child card
    expect(c.overZone()).toBe('today');
    c.onDragLeave('today'); // leave child
    // still over the zone — depth > 0
    expect(c.overZone()).toBe('today');
    c.onDragLeave('today'); // leave zone proper
    expect(c.overZone()).toBeNull();
  });

  it('switches overZone when moving from one zone to another', () => {
    const c = createDndController<'a' | 'b'>();
    c.onDragEnter('a');
    c.onDragEnter('b');
    expect(c.overZone()).toBe('b');
    c.onDragLeave('a');
    // 'a' depth went to 0 but overZone is already 'b', stays 'b'
    expect(c.overZone()).toBe('b');
  });

  it('returns id+zone on drop and clears state', () => {
    const c = createDndController<'today'>();
    c.onDragStart(makeEvent(), 'task-1');
    c.onDragEnter('today');
    expect(c.onDrop('today')).toEqual({ id: 'task-1', zone: 'today' });
    expect(c.draggingId()).toBeNull();
    expect(c.overZone()).toBeNull();
  });

  it('returns null on drop without an active drag (e.g. external drop)', () => {
    const c = createDndController<'today'>();
    expect(c.onDrop('today')).toBeNull();
  });

  it('clears all state on dragend, including stale depth', () => {
    const c = createDndController<'a'>();
    c.onDragStart(makeEvent(), 'x');
    c.onDragEnter('a');
    c.onDragEnter('a');
    c.onDragEnd();
    expect(c.draggingId()).toBeNull();
    expect(c.overZone()).toBeNull();
    // depth is internal; verify reset by triggering a single leave — it must
    // not go negative or resurrect the highlight
    c.onDragLeave('a');
    expect(c.overZone()).toBeNull();
  });
});
