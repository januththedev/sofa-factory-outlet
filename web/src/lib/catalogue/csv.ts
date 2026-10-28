import Papa from 'papaparse';
import { z } from 'zod';

export const CSV_COLUMNS = [
  'name',
  'category',
  'price',
  'status',
  'material',
  'shape',
  'seats',
  'tags',
  'description',
  'colour_1_name',
  'colour_1_hex',
  'colour_1_photo_urls',
  'colour_2_name',
  'colour_2_hex',
  'colour_2_photo_urls',
] as const;

export type CsvColour = { name: string; hex: string; photoUrls: string[] };

export type CsvProduct = {
  name: string;
  category: string;
  priceMinor: number | null;
  status: 'draft' | 'published' | 'hidden';
  material: string | null;
  shape: string | null;
  seats: number | null;
  tags: string[];
  description: string;
  colours: CsvColour[];
};

export type CsvRowError = { line: number; messages: string[] };

export type CsvParseResult = { rows: CsvProduct[]; errors: CsvRowError[] };

const baseSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  category: z.string().trim().min(1, 'category is required'),
  price: z.string(),
  status: z.enum(['draft', 'published', 'hidden']),
  material: z.string(),
  shape: z.string(),
  seats: z.string(),
  tags: z.string(),
  description: z.string(),
}).loose();

const blankToNull = (value: string) => value.trim() || null;

function moneyToMinor(value: string): number | null {
  const clean = value.trim().replace(/^(?:rs\.?|lkr)\s*/iu, '').replace(/,/gu, '');
  if (!clean) return null;
  if (!/^\d+(?:\.\d{1,2})?$/u.test(clean)) throw new Error('price must be a positive rupee amount');
  const minor = Math.round(Number(clean) * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('price is too large');
  return minor;
}

function parseColours(record: Record<string, string>, messages: string[]): CsvColour[] {
  const indexes = new Set<number>();
  for (const key of Object.keys(record)) {
    const match = /^colour_(\d+)_(name|hex|photo_urls)$/u.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  const colours: CsvColour[] = [];
  for (const index of [...indexes].sort((a, b) => a - b)) {
    const name = record[`colour_${index}_name`]?.trim() ?? '';
    const rawHex = record[`colour_${index}_hex`]?.trim() ?? '';
    const rawUrls = record[`colour_${index}_photo_urls`]?.trim() ?? '';
    if (!name && !rawHex && !rawUrls) continue;
    if (!name) messages.push(`colour ${index} name is required`);
    if (!/^#[0-9a-f]{6}$/iu.test(rawHex)) messages.push(`colour ${index} hex must be #RRGGBB`);
    const photoUrls = rawUrls.split(/[|\n]/u).map((url) => url.trim()).filter(Boolean);
    if (photoUrls.some((url) => !url.startsWith('https://'))) {
      messages.push(`colour ${index} photo URLs must use https`);
    }
    if (name && /^#[0-9a-f]{6}$/iu.test(rawHex) && photoUrls.every((url) => url.startsWith('https://'))) {
      colours.push({ name, hex: rawHex.toUpperCase(), photoUrls });
    }
  }
  return colours;
}

export function parseProductCsv(input: string): CsvParseResult {
  const source = input.replace(/^\uFEFF/u, '');
  const parsed = Papa.parse<Record<string, string>>(source, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const rows: CsvProduct[] = [];
  const errors: CsvRowError[] = parsed.errors.map((error) => ({
    line: error.row === undefined ? 1 : error.row + 2,
    messages: [error.message],
  }));
  parsed.data.forEach((record, rowIndex) => {
    const line = rowIndex + 2;
    const result = baseSchema.safeParse(record);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    let priceMinor: number | null = null;
    try {
      priceMinor = moneyToMinor(record.price ?? '');
    } catch (error) {
      messages.push(error instanceof Error ? error.message : 'invalid price');
    }
    const seatsText = record.seats?.trim() ?? '';
    const seats = seatsText ? Number(seatsText) : null;
    if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 30)) {
      messages.push('seats must be a whole number from 1 to 30');
    }
    const colours = parseColours(record, messages);
    if (messages.length || !result.success) {
      errors.push({ line, messages });
      return;
    }
    rows.push({
      name: result.data.name,
      category: result.data.category,
      priceMinor,
      status: result.data.status,
      material: blankToNull(result.data.material),
      shape: blankToNull(result.data.shape),
      seats,
      tags: result.data.tags.split(/[|,]/u).map((tag) => tag.trim()).filter(Boolean),
      description: result.data.description,
      colours,
    });
  });
  return { rows, errors };
}

export function productCsvTemplate(): string {
  return `${CSV_COLUMNS.join(',')}\nExample Sofa,sofas,125000,draft,velvet,l-shape,5,featured|guide:sofa-care,` +
    `A practical description,Green,#33664A,https://example.com/green.webp,,,,\n`;
}
