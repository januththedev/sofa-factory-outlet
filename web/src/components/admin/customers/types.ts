import type { CustomerField } from '@/lib/admin/customers';

/** What the customer form gets back from its server action. */
export type CustomerFormState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
      fieldErrors?: Partial<Record<CustomerField, string>>;
      /** What was typed, so a form that failed keeps its text. */
      values?: Record<string, string>;
      /** The customer that already uses the phone number. */
      existing?: { id: number; name: string };
    }
  | undefined;

export type CustomerFormAction = (previous: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
