import { TestBed } from '@angular/core/testing';

import { IdbService } from './idb.service';

describe('IdbService', () => {
  let svc: IdbService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(IdbService);
    // why: fake-indexeddb persists across tests in the same module; explicit
    //      clear is simpler than juggling deleteDatabase + close.
    await svc.clear('drafts');
    await svc.clear('theme-custom');
  });

  it('set+get roundtrips a value', async () => {
    await svc.set('drafts', 'a', { hello: 'world' });
    const out = await svc.get<{ hello: string }>('drafts', 'a');
    expect(out).toEqual({ hello: 'world' });
  });

  it('get returns undefined for missing key', async () => {
    const out = await svc.get('drafts', 'missing');
    expect(out).toBeUndefined();
  });

  it('keys lists everything in a store', async () => {
    await svc.set('drafts', 'a', 1);
    await svc.set('drafts', 'b', 2);
    const keys = await svc.keys('drafts');
    expect([...keys].sort()).toEqual(['a', 'b']);
  });

  it('delete removes a key', async () => {
    await svc.set('drafts', 'a', 1);
    await svc.delete('drafts', 'a');
    expect(await svc.get('drafts', 'a')).toBeUndefined();
  });

  it('clear empties a store', async () => {
    await svc.set('drafts', 'a', 1);
    await svc.set('drafts', 'b', 2);
    await svc.clear('drafts');
    expect(await svc.keys('drafts')).toEqual([]);
  });

  it('stores are isolated from each other', async () => {
    await svc.set('drafts', 'a', 'draft');
    await svc.set('theme-custom', 'a', 'theme');
    expect(await svc.get('drafts', 'a')).toBe('draft');
    expect(await svc.get('theme-custom', 'a')).toBe('theme');
  });
});
