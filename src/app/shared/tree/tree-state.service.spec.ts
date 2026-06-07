import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TreeStateService } from './tree-state.service';

describe('TreeStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts empty', () => {
    const svc = TestBed.inject(TreeStateService);
    expect(svc.isExpanded('a')).toBe(false);
  });

  it('toggles a node on and off', () => {
    const svc = TestBed.inject(TreeStateService);
    svc.toggle('a');
    expect(svc.isExpanded('a')).toBe(true);
    svc.toggle('a');
    expect(svc.isExpanded('a')).toBe(false);
  });

  it('persists to localStorage and reads it back', () => {
    const svc = TestBed.inject(TreeStateService);
    svc.toggle('a');
    svc.toggle('b');
    TestBed.resetTestingModule();
    const next = TestBed.inject(TreeStateService);
    expect(next.isExpanded('a')).toBe(true);
    expect(next.isExpanded('b')).toBe(true);
  });

  it('expandAll only flips nodes that were collapsed', () => {
    const svc = TestBed.inject(TreeStateService);
    svc.toggle('a');
    svc.expandAll(['a', 'b', 'c']);
    expect(svc.isExpanded('a')).toBe(true);
    expect(svc.isExpanded('b')).toBe(true);
    expect(svc.isExpanded('c')).toBe(true);
  });
});
