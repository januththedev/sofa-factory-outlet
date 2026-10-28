import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollWhenVisible } from '@/lib/polling';

describe('visibility-aware polling', () => {
  let page: EventTarget & { hidden: boolean };
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('document', page);
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pauses hidden tabs and catches up on visibility, without overlapping requests', async () => {
    let complete: (() => void) | undefined;
    const poll = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    stop = pollWhenVisible(poll, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenCalledTimes(1);
    complete?.();
    await vi.advanceTimersByTimeAsync(0);
    page.hidden = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(poll).toHaveBeenCalledTimes(1);
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(poll).toHaveBeenCalledTimes(2);
    page.dispatchEvent(new Event('visibilitychange'));
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('aborts on cleanup and removes interval and visibility listeners', async () => {
    const poll = vi.fn(async (signal: AbortSignal) => { expect(signal.aborted).toBe(false); });
    stop = pollWhenVisible(poll, 1000);
    const signal = poll.mock.calls[0][0];
    stop();
    expect(signal.aborted).toBe(true);
    page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves explicitly enabled background alerts and recovers after network errors', async () => {
    page.hidden = true;
    const poll = vi.fn(async () => {});
    poll.mockRejectedValueOnce(new Error('offline'));
    stop = pollWhenVisible(poll, 1000, { background: () => true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(2);
  });
});
