'use server';
import { requestQuote } from '@/lib/leads/service';
import type { QuoteState } from '@/lib/leads/schema';
export async function submitQuote(
  _previous: QuoteState,
  form: FormData,
): Promise<QuoteState> {
  let items: unknown;
  let attribution: unknown;
  try {
    items = JSON.parse(String(form.get('items')));
    attribution = JSON.parse(String(form.get('attribution')));
  } catch {
    return {
      ok: false,
      message: 'Your selected pieces could not be read. Refresh and try again.',
    };
  }
  try {
    return await requestQuote({
      ...Object.fromEntries(form),
      items,
      attribution,
      consent: form.get('consent') === 'on',
    });
  } catch (error) {
    console.error(
      '[quote] submission failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return {
      ok: false,
      message:
        'We could not save your request. Your details are still here; please try again.',
    };
  }
}
