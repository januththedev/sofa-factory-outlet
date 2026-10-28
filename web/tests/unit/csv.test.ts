import { describe, expect, it } from 'vitest';
import { parseProductCsv, productCsvTemplate } from '@/lib/catalogue/csv';

const header = 'name,category,price,status,material,shape,seats,tags,description,' +
  'colour_1_name,colour_1_hex,colour_1_photo_urls';

describe('product CSV', () => {
  it('parses a valid product and converts rupees to minor units', () => {
    const csv = `${header}\n` +
      'Oslo Sofa,sofas,"125,000.50",published,velvet,l-shape,5,a|b,Copy,Green,#33664A,';
    const result = parseProductCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: 'Oslo Sofa', priceMinor: 12_500_050, seats: 5 });
  });

  it('reports invalid rows with their CSV line', () => {
    const result = parseProductCsv(`${header}\n,sofas,nope,live,,,0,,Copy,Green,green,http://bad.test/a.jpg`);
    expect(result.rows).toEqual([]);
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[0].messages.length).toBeGreaterThan(2);
  });

  it('discovers edge colour columns beyond the template groups', () => {
    const input = `${header},colour_7_name,colour_7_hex,colour_7_photo_urls\n` +
      'Oslo,sofas,,draft,,,,,Copy,,,,Blue,#123456,https://example.com/a.jpg';
    expect(parseProductCsv(input).rows[0].colours).toEqual([
      { name: 'Blue', hex: '#123456', photoUrls: ['https://example.com/a.jpg'] },
    ]);
  });

  it('parses multiple colour groups and pipe-separated photo URLs', () => {
    const input = `${header},colour_2_name,colour_2_hex,colour_2_photo_urls\n` +
      'Oslo,sofas,,draft,,,,,Copy,Green,#33664A,https://a.test/1|https://a.test/2,Blue,#123456,';
    const result = parseProductCsv(input);
    expect(result.rows[0].colours).toHaveLength(2);
    expect(result.rows[0].colours[0].photoUrls).toHaveLength(2);
  });

  it('handles a BOM and quoted commas', () => {
    const result = parseProductCsv(`\uFEFF${header}\n"Oslo, Large",sofas,,draft,,,,,"Copy, with comma",,,`);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toBe('Oslo, Large');
    expect(result.rows[0].description).toBe('Copy, with comma');
  });

  it('provides a downloadable template with the required columns', () => {
    expect(productCsvTemplate()).toContain('colour_2_photo_urls');
    expect(productCsvTemplate()).toContain('name,category,price,status');
  });
});
