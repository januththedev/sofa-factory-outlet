import { describe, expect, it } from 'vitest';
import {
  bpToPercent,
  parseClosedDates,
  parseModelList,
  parsePercentToBp,
  percentToBp,
  type SlotInput,
  sortSlots,
  validateSlots,
} from '@/lib/admin/settings';
import {
  applyBusiness,
  applyChat,
  businessSchema,
  chatSeoSchema,
  fieldErrors,
  hoursSchema,
  invoiceSchema,
  proofSchema,
  staffSchema,
  unflatten,
} from '@/app/admin/(panel)/settings/schemas';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

const slot = (weekday: number, start: string, end: string, extra: Partial<SlotInput> = {}): SlotInput => ({
  weekday,
  start,
  end,
  capacity: 3,
  active: true,
  ...extra,
});

describe('tax rate in basis points', () => {
  it('converts both ways', () => {
    expect(percentToBp(18)).toBe(1800);
    expect(bpToPercent(1800)).toBe(18);
    expect(percentToBp(7.5)).toBe(750);
    expect(bpToPercent(750)).toBe(7.5);
  });

  it('avoids floating point drift', () => {
    expect(percentToBp(8.9)).toBe(890);
    expect(percentToBp(1.15)).toBe(115);
    expect(percentToBp(0.29)).toBe(29);
  });

  it.each([
    ['18', 1800],
    ['7.5', 750],
    ['0', 0],
    ['100', 10_000],
    ['12.25', 1225],
    ['18%', 1800],
    [' 5 ', 500],
  ])('parses %j as %i basis points', (text, bp) => {
    expect(parsePercentToBp(text)).toBe(bp);
  });

  it.each(['', 'abc', '-1', '101', '100.01', '1.234', '1,5', '1e2', '.5', '18 %%'])('rejects %j', (text) => {
    expect(parsePercentToBp(text)).toBeNull();
  });

  it('round-trips every whole and half percent', () => {
    for (let bp = 0; bp <= 10_000; bp += 25) {
      expect(parsePercentToBp(String(bpToPercent(bp)))).toBe(bp);
    }
  });
});

describe('validateSlots', () => {
  it('accepts a normal day of back-to-back slots', () => {
    const slots = [slot(1, '10:00', '12:00'), slot(1, '12:00', '14:00'), slot(1, '14:00', '16:00')];
    expect(validateSlots(slots)).toEqual([]);
  });

  it('accepts an empty table', () => {
    expect(validateSlots([])).toEqual([]);
  });

  it('rejects an end time that is not after the start', () => {
    const [before] = validateSlots([slot(1, '12:00', '10:00')]);
    expect(before.message).toContain('end time must be after the start time');
    expect(validateSlots([slot(1, '10:00', '10:00')])).toHaveLength(1);
  });

  it('rejects overlapping slots on the same weekday and names the clash', () => {
    const problems = validateSlots([slot(2, '10:00', '12:00'), slot(2, '11:00', '13:00')]);
    expect(problems).toHaveLength(1);
    expect(problems[0].index).toBe(1);
    expect(problems[0].message).toContain('Tuesday');
    expect(problems[0].message).toContain('11:00–13:00 overlaps 10:00–12:00');
  });

  it('catches containment and identical slots as overlaps', () => {
    expect(validateSlots([slot(3, '09:00', '17:00'), slot(3, '10:00', '11:00')])).toHaveLength(1);
    expect(validateSlots([slot(3, '10:00', '11:00'), slot(3, '10:00', '11:00')])).toHaveLength(1);
  });

  it('catches an overlap regardless of row order', () => {
    expect(validateSlots([slot(4, '11:00', '13:00'), slot(4, '10:00', '12:00')])).toHaveLength(1);
  });

  it('lets slots on different weekdays share times', () => {
    expect(validateSlots([slot(1, '10:00', '12:00'), slot(2, '10:00', '12:00')])).toEqual([]);
  });

  it('ignores inactive slots when looking for overlaps', () => {
    const slots = [slot(1, '10:00', '12:00'), slot(1, '11:00', '13:00', { active: false })];
    expect(validateSlots(slots)).toEqual([]);
  });

  it('still checks an inactive slot for ordering', () => {
    expect(validateSlots([slot(1, '12:00', '11:00', { active: false })])).toHaveLength(1);
  });

  it.each([['9:00'], ['24:00'], ['10:60'], ['ten'], ['']])('rejects the time %j', (bad) => {
    expect(validateSlots([slot(1, bad, '23:00')])).toHaveLength(1);
    expect(validateSlots([slot(1, '01:00', bad)])).toHaveLength(1);
  });

  it('checks the weekday and the capacity', () => {
    expect(validateSlots([slot(7, '10:00', '11:00')])).toHaveLength(1);
    expect(validateSlots([slot(-1, '10:00', '11:00')])).toHaveLength(1);
    expect(validateSlots([slot(1, '10:00', '11:00', { capacity: 0 })])).toHaveLength(1);
    expect(validateSlots([slot(1, '10:00', '11:00', { capacity: 2.5 })])).toHaveLength(1);
    expect(validateSlots([slot(1, '10:00', '11:00', { capacity: 51 })])).toHaveLength(1);
    expect(validateSlots([slot(1, '10:00', '11:00', { capacity: 50 })])).toEqual([]);
  });

  it('reports problems against their row, in row order', () => {
    const problems = validateSlots([
      slot(1, '10:00', '12:00'),
      slot(1, '12:00', '11:00'),
      slot(1, '09:00', '10:30'),
    ]);
    expect(problems.map((problem) => problem.index)).toEqual([1, 2]);
  });

  it('does not let a broken row hide an overlap between two good ones', () => {
    const problems = validateSlots([slot(1, '10:00', '12:00'), slot(1, 'x', 'y'), slot(1, '11:00', '12:30')]);
    expect(problems.map((problem) => problem.index)).toEqual([1, 2]);
  });
});

describe('sortSlots', () => {
  it('puts Monday first and Sunday last, then orders by start time', () => {
    const sorted = sortSlots([
      slot(0, '10:00', '11:00'),
      slot(2, '14:00', '15:00'),
      slot(2, '10:00', '11:00'),
      slot(1, '09:00', '10:00'),
    ]);
    expect(sorted.map((row) => `${row.weekday}@${row.start}`)).toEqual(['1@09:00', '2@10:00', '2@14:00', '0@10:00']);
  });
});

describe('parseClosedDates', () => {
  it('sorts, removes repeats and accepts commas or new lines', () => {
    const { dates, invalid } = parseClosedDates('2026-12-25\n2026-01-01, 2026-12-25\n\n  2026-04-14 ');
    expect(dates).toEqual(['2026-01-01', '2026-04-14', '2026-12-25']);
    expect(invalid).toEqual([]);
  });

  it('reports what is not a real calendar date', () => {
    const { dates, invalid } = parseClosedDates('2026-02-30\n2026-13-01\n26-01-01\nChristmas\n2028-02-29');
    expect(dates).toEqual(['2028-02-29']);
    expect(invalid).toEqual(['2026-02-30', '2026-13-01', '26-01-01', 'Christmas']);
  });

  it('treats empty text as no dates', () => {
    expect(parseClosedDates('  \n ')).toEqual({ dates: [], invalid: [] });
  });
});

describe('parseModelList', () => {
  it('splits, trims and removes repeats', () => {
    const text = 'google/gemma-4-31b-it:free,\n nvidia/nemotron:free , google/gemma-4-31b-it:free';
    const { models, invalid } = parseModelList(text);
    expect(models).toEqual(['google/gemma-4-31b-it:free', 'nvidia/nemotron:free']);
    expect(invalid).toEqual([]);
  });

  it('returns null for an empty list so the default list is used', () => {
    expect(parseModelList(' , ').models).toBeNull();
  });

  it('reports ids with spaces or odd characters', () => {
    const { models, invalid } = parseModelList('good/model, bad model, <script>');
    expect(models).toEqual(['good/model']);
    expect(invalid).toEqual(['bad model', '<script>']);
  });
});

describe('unflatten', () => {
  it('builds nested objects from dotted names', () => {
    expect(unflatten([['a.b.c', '1'], ['a.b.d', '2'], ['e', '3']])).toEqual({ a: { b: { c: '1', d: '2' } }, e: '3' });
  });

  it('ignores files and unsafe path segments', () => {
    const result = unflatten([
      ['__proto__.polluted', 'yes'],
      ['a.constructor.b', 'yes'],
      ['file', new Blob(['x'])],
      ['', 'empty'],
      ['a..b', 'gap'],
      ['ok', 'fine'],
    ]);
    expect(result).toEqual({ ok: 'fine' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('lets a later field replace a value that was in the way', () => {
    expect(unflatten([['a', 'x'], ['a.b', 'y']])).toEqual({ a: { b: 'y' } });
  });
});

const businessForm = (over: Record<string, string> = {}) =>
  unflatten(
    Object.entries({
      name: 'Sofa Factory Outlet',
      tagline: 'Made in Colombo',
      'address.street': '67 Pallidora Road',
      'address.locality': 'Dehiwala',
      'address.city': 'Colombo',
      'address.postalCode': '',
      'address.confirmed': 'on',
      'phone.number': '011 234 5678',
      'phone.confirmed': 'on',
      'whatsapp.number': '077 671 1711',
      'email.address': 'Hello@Example.lk',
      'social.facebook': 'https://facebook.com/x',
      'social.instagram': '',
      'social.tiktok': '',
      'social.youtube': '',
      'map.placeUrl': 'https://maps.app.goo.gl/abc',
      'map.googleReviewUrl': '',
      priceRange: 'LKR',
      ...over,
    }),
  );

describe('business form', () => {
  it('normalises phones and emails and turns checkboxes into booleans', () => {
    const parsed = businessSchema.parse(businessForm());
    expect(parsed.phone).toEqual({ number: '+94112345678', confirmed: true });
    expect(parsed.whatsapp).toEqual({ number: '+94776711711', confirmed: false });
    expect(parsed.email).toEqual({ address: 'hello@example.lk', confirmed: false });
    expect(parsed.address.postalCode).toBeNull();
    expect(parsed.address.confirmed).toBe(true);
    expect(parsed.social.instagram).toBeNull();
  });

  it('accepts https links only', () => {
    const notHttps = ['http://facebook.com/x', 'javascript:alert(1)', 'facebook.com/x', 'https://user:pw@evil.example'];
    for (const bad of notHttps) {
      const result = businessSchema.safeParse(businessForm({ 'social.facebook': bad }));
      expect(result.success, bad).toBe(false);
      if (!result.success) expect(fieldErrors(result.error)['social.facebook']).toContain('https://');
    }
  });

  it('puts a message on a bad phone number, under that field', () => {
    const result = businessSchema.safeParse(businessForm({ 'phone.number': 'call me' }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)['phone.number']).toContain('Sri Lankan number');
  });

  it('will not confirm a detail that is empty', () => {
    const result = businessSchema.safeParse(
      businessForm({
        'phone.number': '',
        'email.address': '',
        'email.confirmed': 'on',
        'map.placeUrl': '',
        'map.confirmed': 'on',
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors['phone.confirmed']).toBeDefined();
      expect(errors['email.confirmed']).toBeDefined();
      expect(errors['map.confirmed']).toBeDefined();
    }
  });

  it('requires the name and the address lines', () => {
    const result = businessSchema.safeParse(businessForm({ name: '  ', 'address.street': '' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error))).toEqual(expect.arrayContaining(['name', 'address.street']));
    }
  });

  it('keeps the fields the form does not show', () => {
    const current = structuredClone(DEFAULT_SETTINGS.business);
    current.map.lat = 6.85;
    current.map.lng = 79.86;
    const merged = applyBusiness(current, businessSchema.parse(businessForm()));
    expect(merged.address.country).toBe('LK');
    expect(merged.map.lat).toBe(6.85);
    expect(merged.map.placeUrl).toBe('https://maps.app.goo.gl/abc');
    expect(merged.name).toBe('Sofa Factory Outlet');
  });
});

const hoursForm = (over: Record<string, string> = {}, slots: SlotInput[] = [slot(1, '10:00', '12:00')]) =>
  unflatten(
    Object.entries({
      'hours.days.mon.open': '10:00',
      'hours.days.mon.close': '18:00',
      'hours.days.tue.open': '09:30',
      'hours.days.tue.close': '17:00',
      'hours.days.wed.closed': 'on',
      'hours.days.thu.open': '10:00',
      'hours.days.thu.close': '18:00',
      'hours.days.fri.open': '10:00',
      'hours.days.fri.close': '18:00',
      'hours.days.sat.open': '10:00',
      'hours.days.sat.close': '14:00',
      'hours.days.sun.closed': 'on',
      'hours.closedDates': '2026-12-25\n2026-01-01',
      'hours.note': '',
      'hours.confirmed': 'on',
      'booking.leadDays': '1',
      'booking.horizonDays': '45',
      slots: JSON.stringify(slots),
      ...over,
    }),
  );

describe('hours and visits form', () => {
  it('turns closed days into null and open days into times', () => {
    const parsed = hoursSchema.parse(hoursForm());
    expect(parsed.hours.days.mon).toEqual({ open: '10:00', close: '18:00' });
    expect(parsed.hours.days.wed).toBeNull();
    expect(parsed.hours.days.sun).toBeNull();
    expect(parsed.hours.closedDates).toEqual(['2026-01-01', '2026-12-25']);
    expect(parsed.hours.confirmed).toBe(true);
    expect(parsed.booking).toEqual({ leadDays: 1, horizonDays: 45, confirmed: false });
  });

  it('ignores times typed into a closed day', () => {
    const parsed = hoursSchema.parse(hoursForm({ 'hours.days.wed.open': 'junk', 'hours.days.wed.close': '' }));
    expect(parsed.hours.days.wed).toBeNull();
  });

  it('wants closing after opening, on the closing field', () => {
    const backwards = { 'hours.days.mon.open': '18:00', 'hours.days.mon.close': '10:00' };
    const result = hoursSchema.safeParse(hoursForm(backwards));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)['hours.days.mon.close']).toContain('after opening');
  });

  it('wants both times for an open day', () => {
    const result = hoursSchema.safeParse(hoursForm({ 'hours.days.tue.open': '', 'hours.days.tue.close': '' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)['hours.days.tue.open']).toBeDefined();
      expect(fieldErrors(result.error)['hours.days.tue.close']).toBeDefined();
    }
  });

  it('rejects closed dates that are not dates', () => {
    const result = hoursSchema.safeParse(hoursForm({ 'hours.closedDates': '2026-02-30' }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)['hours.closedDates']).toContain('2026-02-30');
  });

  it('wants the booking window to be longer than the notice', () => {
    const result = hoursSchema.safeParse(hoursForm({ 'booking.leadDays': '10', 'booking.horizonDays': '10' }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)['booking.horizonDays']).toBeDefined();
  });

  it('reports slot problems on the row that has them', () => {
    const result = hoursSchema.safeParse(hoursForm({}, [slot(1, '10:00', '12:00'), slot(1, '11:00', '13:00')]));
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors['slots.1']).toContain('overlaps');
      expect(errors['slots.0']).toBeUndefined();
    }
  });

  it('refuses a slot table that is not valid JSON', () => {
    const result = hoursSchema.safeParse(hoursForm({ slots: '{not json' }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).slots).toContain('slot table');
  });

  it('keeps the id of an existing slot and drops none', () => {
    const parsed = hoursSchema.parse(hoursForm({}, [slot(1, '10:00', '12:00', { id: 7 }), slot(2, '10:00', '12:00')]));
    expect(parsed.slots.map((row) => row.id)).toEqual([7, undefined]);
  });
});

const invoiceForm = (over: Record<string, string> = {}) =>
  unflatten(
    Object.entries({
      prefix: 'sfo',
      quotationPrefix: 'sfo-q',
      taxEnabled: 'on',
      taxLabel: 'VAT',
      taxRatePercent: '18',
      vatNumber: '',
      'bank.bank': 'Example Bank',
      'bank.branch': '',
      'bank.accountName': 'Sofa Factory Outlet',
      'bank.accountNumber': '000123',
      terms: 'Pay on delivery.',
      warranty: 'Ten years structural.',
      ...over,
    }),
  );

describe('invoice form', () => {
  it('stores the rate as basis points and upper-cases prefixes', () => {
    const parsed = invoiceSchema.parse(invoiceForm({ taxRatePercent: '7.5' }));
    expect(parsed.taxRatePercent).toBe(750);
    expect(parsed.prefix).toBe('SFO');
    expect(parsed.quotationPrefix).toBe('SFO-Q');
    expect(parsed.taxEnabled).toBe(true);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.vatNumber).toBeNull();
  });

  it('turns tax off when the box is not ticked', () => {
    expect(invoiceSchema.parse(invoiceForm({ taxEnabled: '' })).taxEnabled).toBe(false);
  });

  it('rejects rates outside 0 to 100 and bad prefixes', () => {
    for (const taxRatePercent of ['101', '-5', 'eighteen', '1.999']) {
      const result = invoiceSchema.safeParse(invoiceForm({ taxRatePercent }));
      expect(result.success, taxRatePercent).toBe(false);
    }
    expect(invoiceSchema.safeParse(invoiceForm({ prefix: 'bad prefix' })).success).toBe(false);
    expect(invoiceSchema.safeParse(invoiceForm({ prefix: '' })).success).toBe(false);
  });

  it('wants the two prefixes to differ', () => {
    const result = invoiceSchema.safeParse(invoiceForm({ prefix: 'SFO', quotationPrefix: 'sfo' }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).quotationPrefix).toBeDefined();
  });
});

describe('proof form', () => {
  const proofForm = (over: Record<string, string> = {}) =>
    unflatten(Object.entries({ 'proof.years': '12', 'proof.homes': '', 'proof.districts': '9', ...over }));

  it('reads blank numbers as unknown', () => {
    const parsed = proofSchema.parse(proofForm());
    expect(parsed.proof).toEqual({ years: 12, homes: null, districts: 9, confirmed: false });
  });

  it('rejects fractions, negatives and more districts than Sri Lanka has', () => {
    const bad: Array<Record<string, string>> = [
      { 'proof.years': '2.5' },
      { 'proof.homes': '-1' },
      { 'proof.districts': '26' },
    ];
    for (const over of bad) {
      expect(proofSchema.safeParse(proofForm(over)).success).toBe(false);
    }
  });

  it('will not confirm with nothing to confirm', () => {
    const empty = proofForm({ 'proof.years': '', 'proof.districts': '', 'proof.confirmed': 'on' });
    expect(proofSchema.safeParse(empty).success).toBe(false);
    expect(proofSchema.safeParse(proofForm({ 'proof.confirmed': 'on' })).success).toBe(true);
  });
});

describe('chat and SEO form', () => {
  const chatForm = (over: Record<string, string> = {}) =>
    unflatten(
      Object.entries({
        'chat.dailyModelBudget': '45',
        'chat.bufferCalls': '5',
        'chat.perSessionModelAnswers': '3',
        'chat.messagesPer10Min': '20',
        'chat.models': '',
        'chat.temperature': '0.2',
        'chat.maxTokens': '250',
        'chat.timeoutMs': '15000',
        'seo.aiCrawlers': 'allow',
        ...over,
      }),
    );

  it('reads numbers, a model list and the switches', () => {
    const parsed = chatSeoSchema.parse(
      chatForm({ 'chat.models': 'a/b, c/d:free', 'seo.aiCrawlers': 'block', 'seo.indexNow': 'on' }),
    );
    expect(parsed.chat).toMatchObject({
      dailyModelBudget: 45,
      temperature: 0.2,
      maxTokens: 250,
      models: ['a/b', 'c/d:free'],
    });
    expect(parsed.seo).toEqual({ aiCrawlers: 'block', indexNow: true });
  });

  it('keeps the embeddings controls the knowledge-base page owns', () => {
    const current = structuredClone(DEFAULT_SETTINGS.chat);
    current.embeddings = { enabled: true, model: 'some/embed-model', dim: 768 };
    const merged = applyChat(current, chatSeoSchema.parse(chatForm({ 'chat.dailyModelBudget': '10' })));
    expect(merged.embeddings).toEqual({ enabled: true, model: 'some/embed-model', dim: 768 });
    expect(merged.dailyModelBudget).toBe(10);
    expect(merged.models).toBeNull();
  });

  it.each([
    ['chat.temperature', '2.5'],
    ['chat.temperature', 'warm'],
    ['chat.maxTokens', '5'],
    ['chat.timeoutMs', '100'],
    ['chat.messagesPer10Min', '0'],
    ['chat.dailyModelBudget', '-1'],
    ['chat.dailyModelBudget', '4.5'],
    ['chat.dailyModelBudget', ''],
    ['seo.aiCrawlers', 'maybe'],
  ])('rejects %s = %j, naming that field', (name, value) => {
    const result = chatSeoSchema.safeParse(chatForm({ [name]: value }));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[name]).toBeDefined();
  });
});

describe('staff form', () => {
  const parse = (fields: Record<string, string>) => staffSchema.safeParse(unflatten(Object.entries(fields)));

  it('reads each operation', () => {
    expect(parse({ intent: 'create', name: ' Nimal ', email: 'Nimal@Example.LK', role: 'staff' })).toMatchObject({
      success: true,
      data: { intent: 'create', name: 'Nimal', email: 'nimal@example.lk', role: 'staff' },
    });
    expect(parse({ intent: 'role', id: '4', role: 'owner' })).toMatchObject({ success: true, data: { id: 4 } });
    expect(parse({ intent: 'active', id: '4', active: 'false' })).toMatchObject({
      success: true,
      data: { active: false },
    });
    expect(parse({ intent: 'reset', id: '4' })).toMatchObject({ success: true });
  });

  it('rejects bad emails, roles and ids', () => {
    expect(parse({ intent: 'create', name: 'A', email: 'not-an-email', role: 'staff' }).success).toBe(false);
    expect(parse({ intent: 'create', name: 'A', email: 'a@b.lk', role: 'admin' }).success).toBe(false);
    expect(parse({ intent: 'create', name: '', email: 'a@b.lk', role: 'staff' }).success).toBe(false);
    expect(parse({ intent: 'role', id: 'abc', role: 'staff' }).success).toBe(false);
    expect(parse({ intent: 'role', id: '-3', role: 'staff' }).success).toBe(false);
    expect(parse({ intent: 'active', id: '1', active: 'maybe' }).success).toBe(false);
    expect(parse({ intent: 'delete', id: '1' }).success).toBe(false);
  });
});
