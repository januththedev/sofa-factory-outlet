import { describe, expect, it } from 'vitest';
import { buildShopUrl, parseShopParams } from '@/lib/catalogue/search';

describe('shop URL parameters', () => {
  it('parses repeated and comma-separated filters', () => {
    expect(parseShopParams({ colour: ['green,blue', 'green'], seats: '3,2', sort: 'newest' })).toMatchObject({ colour: ['blue', 'green'], seats: [2, 3], sort: 'newest' });
  });
  it('drops unknown values and clamps numbers', () => {
    expect(parseShopParams({ nope: 'x', sort: 'random', page: '-2', pageSize: '1000', seats: 'x,0,4' })).toEqual({ pageSize: 48, seats: [4] });
  });
  it('builds a stable URL and round trips', () => {
    const params = { colour: ['green', 'blue'], shape: ['l-shape'], page: 2 };
    const url = buildShopUrl(params);
    expect(url).toBe('/shop/?colour=blue%2Cgreen&page=2&shape=l-shape');
    expect(parseShopParams(Object.fromEntries(new URL(`https://example.test${url}`).searchParams))).toEqual({ colour: ['blue', 'green'], page: 2, shape: ['l-shape'] });
  });
});
