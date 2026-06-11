import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LockChannel } from './lock-channel';
import { LockService } from './lock.service';
import { LOCK_PONG_WAIT_MS, type LockMessage } from './lock.types';

class FakeBus {
  readonly channels: FakeChannel[] = [];
  publish(from: FakeChannel, msg: LockMessage): void {
    for (const c of this.channels) if (c !== from) c.deliver(msg);
  }
}

class FakeChannel {
  private readonly listeners = new Set<(msg: LockMessage) => void>();
  constructor(private readonly bus: FakeBus) {
    bus.channels.push(this);
  }
  post(msg: LockMessage): void {
    this.bus.publish(this, msg);
  }
  onMessage(fn: (msg: LockMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  deliver(msg: LockMessage): void {
    for (const l of this.listeners) l(msg);
  }
}

function makeTab(bus: FakeBus): LockService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: LockChannel, useValue: new FakeChannel(bus) }],
  });
  return TestBed.inject(LockService);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('LockService', () => {
  it('grants the first claimant', async () => {
    const bus = new FakeBus();
    const tab = makeTab(bus);
    const outcome = await tab.acquire('note', 'n1');
    expect(outcome.granted).toBe(true);
    expect(tab.state('note', 'n1')()).toBe('owned');
  });

  // Regression for MCB-AUT-005 firing on single-tab loads: state must
  // be 'owned' synchronously so that the editor's onUpdate-on-init
  // doesn't trip guardWrite during the 150 ms pong window.
  it('state is owned synchronously while acquire is pending', () => {
    const bus = new FakeBus();
    const tab = makeTab(bus);
    void tab.acquire('note', 'n1');
    expect(tab.state('note', 'n1')()).toBe('owned');
  });

  it('rejects a second claimant and reports owner', async () => {
    const bus = new FakeBus();
    const a = makeTab(bus);
    const b = makeTab(bus);
    await a.acquire('note', 'n1');
    const outcome = await b.acquire('note', 'n1');
    expect(outcome.granted).toBe(false);
    if (!outcome.granted) {
      expect(outcome.ownerTabId).toBe(a.tabId);
    }
    expect(b.state('note', 'n1')()).toBe('foreign');
  });

  it('releasing frees the lock for the other tab', async () => {
    const bus = new FakeBus();
    const a = makeTab(bus);
    const b = makeTab(bus);
    await a.acquire('note', 'n1');
    a.release('note', 'n1');
    // give the release message a chance to deliver
    await wait(5);
    expect(b.state('note', 'n1')()).toBe('idle');
    const outcome = await b.acquire('note', 'n1');
    expect(outcome.granted).toBe(true);
  });

  it('takeover evicts the previous owner', async () => {
    const bus = new FakeBus();
    const a = makeTab(bus);
    const b = makeTab(bus);
    await a.acquire('note', 'n1');
    await b.acquire('note', 'n1');
    b.takeover('note', 'n1');
    await wait(5);
    expect(a.state('note', 'n1')()).toBe('evicted');
    expect(b.state('note', 'n1')()).toBe('owned');
  });

  it('cleared eviction returns to idle', async () => {
    const bus = new FakeBus();
    const a = makeTab(bus);
    const b = makeTab(bus);
    await a.acquire('note', 'n1');
    await b.acquire('note', 'n1');
    b.takeover('note', 'n1');
    await wait(5);
    a.clearEviction('note', 'n1');
    expect(a.state('note', 'n1')()).toBe('idle');
  });

  it('different keys do not interfere', async () => {
    const bus = new FakeBus();
    const a = makeTab(bus);
    const b = makeTab(bus);
    await a.acquire('note', 'n1');
    const outcome = await b.acquire('note', 'n2');
    expect(outcome.granted).toBe(true);
  });

  it('pong wait is roughly bounded', async () => {
    const bus = new FakeBus();
    const tab = makeTab(bus);
    const t0 = Date.now();
    await tab.acquire('note', 'n1');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(LOCK_PONG_WAIT_MS - 20);
  });
});
