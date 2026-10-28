export type ExtractedDetails = {
  category?: string;
  colour?: string;
  material?: string;
  shape?: string;
  seats?: number;
  maxPrice?: number;
  targetPrice?: number;
  roomSize?: string;
};

function first(query: string, values: string[]): string | undefined {
  return values.find((value) => query.includes(value));
}

function amountFromMatch(amount: string, suffix?: string): number {
  if (suffix === 'k') {
    return Math.round(Number(amount) * 1_000);
  }
  if (suffix?.startsWith('lakh') || suffix?.startsWith('lac')) {
    return Math.round(Number(amount) * 100_000);
  }
  return Math.round(Number(amount));
}

export function extractDetails(query: string): ExtractedDetails {
  const details: ExtractedDetails = {};
  details.colour = first(query, [
    'green',
    'grey',
    'gray',
    'blue',
    'navy',
    'teal',
    'cream',
    'beige',
    'brown',
    'camel',
    'black',
    'white',
    'pink',
    'red',
    'maroon',
    'mustard',
    'yellow',
    'orange',
  ]);
  if (details.colour === 'gray') {
    details.colour = 'grey';
  }
  details.material = first(query, ['velvet', 'leather', 'fabric', 'corduroy', 'linen']);
  const shape = first(query, ['l-shape', 'u-shape', '3+2+1', 'corner', 'sectional']);
  if (shape) {
    details.shape = shape === 'corner' || shape === 'sectional' ? 'l-shape' : shape;
  }
  const seats = query.match(/\b(\d+)\s*(?:seat|seater)s?\b/);
  if (seats) {
    details.seats = Number(seats[1]);
  }
  const measuredRoom = query.match(
    /\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:ft|feet|m|metres?)?\b/,
  )?.[0];
  details.roomSize = measuredRoom ?? first(query, ['small flat', 'small room', 'large room']);

  const money = query.match(
    /\b(under|below|less than|up to|around|about|budget(?: of)?)\s*(?:lkr|rs\.?)?\s*/
      .source.concat('(\\d+(?:\\.\\d+)?)\\s*(k|lakhs?|lacs?)?\\b'),
  );
  if (money) {
    const amount = amountFromMatch(money[2], money[3]);
    if (/under|below|less than|up to/.test(money[1])) {
      details.maxPrice = amount;
    } else {
      details.targetPrice = amount;
    }
  }

  if (query.includes('sofa')) {
    details.category = 'sofas';
  } else if (query.includes('bed')) {
    details.category = 'beds';
  } else if (query.includes('chair')) {
    details.category = 'chairs';
  } else if (query.includes('table')) {
    details.category = 'tables';
  } else if (query.includes('ottoman')) {
    details.category = 'ottomans';
  }

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  ) as ExtractedDetails;
}
