import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachProductResults } from '@/components/catalogue/results-memory';
import { markReturning } from '@/components/catalogue/results-memory';
import { parseResults } from '@/components/catalogue/results-memory';
import { readProductResults } from '@/components/catalogue/results-memory';
import { readResults } from '@/components/catalogue/results-memory';
import { rememberResults } from '@/components/catalogue/results-memory';
import { restoreResults } from '@/components/catalogue/results-memory';

const stored = new Map<string, string>();
const history = {
  state: {} as Record<string, unknown>,
  replaceState: vi.fn((state: Record<string, unknown>) => {
    history.state = state;
  }),
};
const browser = {
  location: { pathname: '/shop/', search: '?colour=green&page=2' },
  scrollY: 843.5,
  history,
  dispatchEvent: vi.fn(),
  scrollTo: vi.fn(),
  requestAnimationFrame: vi.fn((callback: () => void) => {
    callback();
    return 7;
  }),
  cancelAnimationFrame: vi.fn(),
};

beforeEach(() => {
  stored.clear();
  vi.clearAllMocks();
  history.state = { __NA: true, tree: ['existing Next state'] };
  browser.location = { pathname: '/shop/', search: '?colour=green&page=2' };
  vi.stubGlobal('window', browser);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('returning to catalogue results', () => {
  it('associates a shop click with the product history entry and retains Next history state', () => {
    rememberResults('/product/sofa/');
    attachProductResults('/product/sofa/');
    expect(parseResults(readProductResults())).toMatchObject({
      url: '/shop/?colour=green&page=2', product: '/product/sofa/', scroll: 843.5,
    });
    expect(history.state.__NA).toBe(true);
    expect(history.state.tree).toEqual(['existing Next state']);
  });

  it('uses a matching history entry once, so a later direct visit has no results context', () => {
    rememberResults('/product/sofa/');
    attachProductResults('/product/sofa/');
    history.state = {};
    attachProductResults('/product/sofa/');
    expect(parseResults(readProductResults())).toBeNull();
  });

  it('ignores a click for a different product', () => {
    rememberResults('/product/sofa/');
    attachProductResults('/product/chair/');
    expect(parseResults(readProductResults())).toBeNull();
  });

  it('restores the exact filtered list position and consumes the return request', () => {
    rememberResults('/product/sofa/');
    attachProductResults('/product/sofa/');
    markReturning();
    const cleanup = restoreResults();
    expect(browser.scrollTo).toHaveBeenCalledWith({ top: 843.5, behavior: 'instant' });
    expect(parseResults(readResults())?.returning).toBe(false);
    cleanup?.();
    expect(browser.cancelAnimationFrame).toHaveBeenCalledWith(7);
    restoreResults();
    expect(browser.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not restore a position onto a different query or collection', () => {
    rememberResults('/product/sofa/');
    attachProductResults('/product/sofa/');
    markReturning();
    browser.location.search = '?colour=blue';
    restoreResults();
    expect(browser.scrollTo).not.toHaveBeenCalled();
  });

  it('tolerates blocked storage and falls back to the category link context', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => rememberResults('/product/sofa/')).not.toThrow();
    expect(() => attachProductResults('/product/sofa/')).not.toThrow();
    expect(readResults()).toBe('');
    expect(parseResults(readProductResults())).toBeNull();
  });
});
