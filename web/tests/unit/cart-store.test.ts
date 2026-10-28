import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CartLine,
  type CartSuggestion,
  type NewCartLine,
  cartCount,
  cartKey,
  cartSignature,
  cartTotal,
  isCartPath,
  sanitiseLines,
  suggestionToLine,
  toCartRef,
} from '@/lib/cart/types';

const STORAGE_KEY = 'sfo-cart-v1';

/** An in-memory stand-in for window.localStorage. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

/** A fresh store, as after a page load: new module instance, reading whatever `storage` holds. */
async function loadStore(storage: Storage = memoryStorage()) {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  const { useCart } = await import('@/lib/cart/store');
  await useCart.persist.rehydrate();
  return { useCart, storage };
}

afterEach(() => vi.unstubAllGlobals());

const emerald = (extra: Partial<NewCartLine> = {}): NewCartLine => ({
  productId: 1,
  variantId: 10,
  slug: 'emerald-l-shape',
  name: 'Emerald L-Shape',
  colourName: 'Emerald velvet',
  hex: '#1f5c46',
  image: null,
  priceMinor: 12_490_000,
  ...extra,
});
const navy = (extra: Partial<NewCartLine> = {}) => emerald({ variantId: 11, colourName: 'Navy velvet', hex: '#1c2a4a', ...extra });
const ottoman = (extra: Partial<NewCartLine> = {}) => emerald({ productId: 2, variantId: 20, slug: 'cream-ottoman', name: 'Cream ottoman', colourName: 'Cream', hex: '#efe6d3', priceMinor: 2_500_000, ...extra });

const asLine = (line: NewCartLine, overrides: Partial<CartLine> = {}): CartLine => ({ ...line, key: cartKey(line.productId, line.variantId), quantity: 1, ...overrides });

describe('add', () => {
  it('adds a line keyed by product and colour, defaults to one, and opens the drawer', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    const { lines, drawerOpen } = useCart.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ key: '1:10', quantity: 1, name: 'Emerald L-Shape', colourName: 'Emerald velvet' });
    expect(drawerOpen).toBe(true);
  });

  it('merges quantities when the same product and colour is added again', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 2 }));
    useCart.getState().add(emerald({ quantity: 3 }));
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].quantity).toBe(5);
  });

  it('keeps different colours of one product as separate lines', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().add(navy());
    expect(useCart.getState().lines.map((l) => l.key)).toEqual(['1:10', '1:11']);
  });

  it('caps a line at 20 however it gets there', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 15 }));
    useCart.getState().add(emerald({ quantity: 15 }));
    useCart.getState().add(ottoman({ quantity: 99 }));
    expect(useCart.getState().lines.map((l) => l.quantity)).toEqual([20, 20]);
  });

  it('treats a zero, fractional or non-numeric quantity as a whole number of at least 1', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 0 }));
    useCart.getState().add(navy({ quantity: 2.9 }));
    useCart.getState().add(ottoman({ quantity: Number.NaN }));
    expect(useCart.getState().lines.map((l) => l.quantity)).toEqual([1, 2, 1]);
  });

  it('keeps the reason a suggestion came with', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ reason: 'Cream cushions soften emerald velvet' }));
    expect(useCart.getState().lines[0].reason).toBe('Cream cushions soften emerald velvet');
  });
});

describe('setQuantity and remove', () => {
  it('sets the quantity and clamps it at 20', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().setQuantity('1:10', 4);
    expect(useCart.getState().lines[0].quantity).toBe(4);
    useCart.getState().setQuantity('1:10', 50);
    expect(useCart.getState().lines[0].quantity).toBe(20);
  });

  it('removes the line when the quantity is 0 or below', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().add(ottoman());
    useCart.getState().setQuantity('1:10', 0);
    expect(useCart.getState().lines.map((l) => l.key)).toEqual(['2:20']);
    useCart.getState().setQuantity('2:20', -3);
    expect(useCart.getState().lines).toEqual([]);
  });

  it('ignores unknown keys and quantities that are not numbers, and rounds down fractions', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 3 }));
    useCart.getState().setQuantity('9:9', 5);
    useCart.getState().setQuantity('1:10', Number.NaN);
    expect(useCart.getState().lines.map((l) => [l.key, l.quantity])).toEqual([['1:10', 3]]);
    useCart.getState().setQuantity('1:10', 2.7);
    expect(useCart.getState().lines[0].quantity).toBe(2);
  });

  it('remove drops only that line', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().add(ottoman());
    useCart.getState().remove('1:10');
    expect(useCart.getState().lines.map((l) => l.key)).toEqual(['2:20']);
  });
});

describe('replace', () => {
  it('swaps the colour, keeping the quantity and the line where it was', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 2 }));
    useCart.getState().add(ottoman());
    useCart.getState().replace('1:10', navy());
    const { lines } = useCart.getState();
    expect(lines.map((l) => l.key)).toEqual(['1:11', '2:20']);
    expect(lines[0]).toMatchObject({ colourName: 'Navy velvet', hex: '#1c2a4a', quantity: 2 });
  });

  it('merges into the line that is already in the target colour', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 3 }));
    useCart.getState().add(navy({ quantity: 2 }));
    useCart.getState().add(ottoman());
    useCart.getState().replace('1:10', navy());
    const { lines } = useCart.getState();
    expect(lines.map((l) => [l.key, l.quantity])).toEqual([
      ['1:11', 5],
      ['2:20', 1],
    ]);
  });

  it('caps a merged line at 20', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ quantity: 15 }));
    useCart.getState().add(navy({ quantity: 12 }));
    useCart.getState().replace('1:10', navy());
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].quantity).toBe(20);
  });

  it('does not carry the old colour reason over to the new colour', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald({ reason: 'Goes with emerald' }));
    useCart.getState().replace('1:10', navy());
    expect(useCart.getState().lines[0].reason).toBeUndefined();
  });

  it('does nothing for a line that is not in the cart', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().replace('9:9', navy());
    expect(useCart.getState().lines.map((l) => l.key)).toEqual(['1:10']);
  });
});

describe('clear and drawer', () => {
  it('clear empties the cart', async () => {
    const { useCart } = await loadStore();
    useCart.getState().add(emerald());
    useCart.getState().add(ottoman());
    useCart.getState().clear();
    expect(useCart.getState().lines).toEqual([]);
  });

  it('opens and closes the drawer', async () => {
    const { useCart } = await loadStore();
    expect(useCart.getState().drawerOpen).toBe(false);
    useCart.getState().openDrawer();
    expect(useCart.getState().drawerOpen).toBe(true);
    useCart.getState().closeDrawer();
    expect(useCart.getState().drawerOpen).toBe(false);
  });
});

describe('persistence', () => {
  it('round-trips the lines through storage after a reload', async () => {
    const first = await loadStore();
    first.useCart.getState().add(emerald({ quantity: 2, reason: 'Goes with the rug' }));
    first.useCart.getState().add(ottoman({ priceMinor: null }));
    const saved = first.useCart.getState().lines;

    const reloaded = await loadStore(first.storage);
    expect(reloaded.useCart.getState().lines).toEqual(saved);
    expect(reloaded.useCart.getState().drawerOpen).toBe(false);
    expect(reloaded.useCart.persist.hasHydrated()).toBe(true);
  });

  it('starts empty when nothing was saved', async () => {
    const { useCart } = await loadStore();
    expect(useCart.getState().lines).toEqual([]);
    expect(useCart.persist.hasHydrated()).toBe(true);
  });

  it('stores nothing but the cart lines', async () => {
    const { useCart, storage } = await loadStore();
    useCart.getState().add(emerald());
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    expect(Object.keys(saved.state)).toEqual(['lines']);
  });

  it('drops malformed saved lines, clamps saved quantities and ignores a saved drawer state', async () => {
    const saved = JSON.stringify({
      state: { lines: [{ ...emerald(), key: 'stale', quantity: 99 }, null, 'oops', { productId: 'x' }, emerald({ productId: 0 })], drawerOpen: true },
      version: 0,
    });
    const { useCart } = await loadStore(memoryStorage({ [STORAGE_KEY]: saved }));
    expect(useCart.getState().lines).toEqual([asLine(emerald(), { quantity: 20 })]);
    expect(useCart.getState().drawerOpen).toBe(false);
  });

  it('treats unreadable saved data as an empty cart and still finishes hydrating', async () => {
    const { useCart } = await loadStore(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect(useCart.getState().lines).toEqual([]);
    expect(useCart.persist.hasHydrated()).toBe(true);
  });

  it('keeps working in memory when storage refuses writes', async () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
    };
    const { useCart } = await loadStore(storage);
    expect(() => useCart.getState().add(emerald())).not.toThrow();
    expect(useCart.getState().lines).toHaveLength(1);
  });
});

describe('cartTotal', () => {
  it('is null for an empty cart', () => {
    expect(cartTotal([])).toBeNull();
  });

  it('is null when any line has no price', () => {
    expect(cartTotal([asLine(emerald()), asLine(ottoman({ priceMinor: null }))])).toBeNull();
  });

  it('adds up price times quantity when every line is priced', () => {
    expect(cartTotal([asLine(emerald(), { quantity: 2 }), asLine(ottoman(), { quantity: 3 })])).toBe(2 * 12_490_000 + 3 * 2_500_000);
  });
});

describe('cartCount', () => {
  it('is 0 for an empty cart and otherwise the sum of the quantities', () => {
    expect(cartCount([])).toBe(0);
    expect(cartCount([asLine(emerald(), { quantity: 2 }), asLine(ottoman(), { quantity: 5 })])).toBe(7);
  });
});

describe('helpers', () => {
  const suggestion: CartSuggestion = {
    productId: 7,
    variantId: 71,
    slug: 'cream-cushion-set',
    name: 'Cream cushion set',
    href: '/product/cream-cushion-set/',
    priceMinor: 450_000,
    priceFrom: false,
    image: null,
    colourName: 'Cream',
    hex: '#efe6d3',
    reason: 'Cream cushions soften emerald velvet',
  };

  it('suggestionToLine carries the colour, price and reason (and "from" only when it applies)', () => {
    expect(suggestionToLine(suggestion)).toEqual({
      productId: 7,
      variantId: 71,
      slug: 'cream-cushion-set',
      name: 'Cream cushion set',
      colourName: 'Cream',
      hex: '#efe6d3',
      image: null,
      priceMinor: 450_000,
      reason: 'Cream cushions soften emerald velvet',
    });
    expect(suggestionToLine({ ...suggestion, priceFrom: true }).priceFrom).toBe(true);
  });

  it('cartSignature ignores quantity and order, and changes when a piece or colour changes', () => {
    const a = asLine(emerald(), { quantity: 1 });
    const b = asLine(ottoman(), { quantity: 4 });
    expect(cartSignature([a, b])).toBe(cartSignature([{ ...b, quantity: 1 }, { ...a, quantity: 9 }]));
    expect(cartSignature([a, b])).not.toBe(cartSignature([asLine(navy()), b]));
    expect(cartSignature([])).toBe('');
  });

  it('toCartRef keeps just what the server needs', () => {
    expect(toCartRef([asLine(emerald(), { quantity: 3 })])).toEqual([{ productId: 1, variantId: 10, quantity: 3 }]);
  });

  it('isCartPath matches /cart/ with or without the slash and nothing else', () => {
    expect(isCartPath('/cart/')).toBe(true);
    expect(isCartPath('/cart')).toBe(true);
    expect(isCartPath('/cart-care/')).toBe(false);
    expect(isCartPath('/shop/')).toBe(false);
  });

  it('sanitiseLines merges duplicates, rejects a bad image but keeps the line, and rejects non-arrays', () => {
    expect(sanitiseLines('nope')).toEqual([]);
    expect(sanitiseLines(undefined)).toEqual([]);
    const lines = sanitiseLines([
      { ...emerald(), quantity: 12, image: { src: 42 } },
      { ...emerald(), quantity: 12 },
      { ...ottoman(), priceMinor: -5 },
    ]);
    expect(lines.map((l) => [l.key, l.quantity, l.image, l.priceMinor])).toEqual([
      ['1:10', 20, null, 12_490_000],
      ['2:20', 1, null, null],
    ]);
  });
});
