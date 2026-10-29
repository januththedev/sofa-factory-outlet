import { z } from 'zod';
import { normaliseLkPhone } from '@/lib/phone';
export const LEAD_STAGES = [
  'new',
  'contacted',
  'qualified',
  'quote_sent',
  'won',
  'lost',
] as const;
export const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  quote_sent: 'Quote sent',
  won: 'Won',
  lost: 'Lost',
};
export const quoteSchema = z
  .object({
    requestToken: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(2, 'Enter your full name.').max(80),
    phone: z.string().transform((value, ctx) => {
      const phone = normaliseLkPhone(value);
      if (!phone) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter a valid Sri Lankan phone number.',
        });
        return z.NEVER;
      }
      return phone;
    }),
    email: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) => v === '' || z.email().safeParse(v).success,
        'Enter a valid email address.',
      )
      .default(''),
    city: z.string().trim().min(2, 'Enter your city or district.').max(100),
    preferredContact: z.enum(['whatsapp', 'call', 'email']),
    notes: z.string().trim().max(2000).default(''),
    budget: z.string().trim().max(100).default(''),
    room: z.string().trim().max(200).default(''),
    consent: z.literal(
      true,
      'Please agree so we can contact you about this request.',
    ),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive().max(2_147_483_647),
          variantId: z.number().int().positive().max(2_147_483_647).optional(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .max(20),
    attribution: z
      .record(z.string().max(40), z.string().max(300))
      .refine((v) => Object.keys(v).length <= 10)
      .default({}),
  })
  .refine((v) => v.preferredContact !== 'email' || v.email.length > 0, {
    path: ['email'],
    message: 'Add an email address so we can contact you that way.',
  });
export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteState =
  | { ok: false; message: string; fields?: Record<string, string> }
  | { ok: true; reference: string }
  | null;
