/** What the booking forms get back from their server actions. */
export type ActionState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
      /** What was typed, so a form that failed keeps its text. */
      values?: Record<string, string>;
    }
  | undefined;

/** A server action with the booking id already bound, as the page hands it to a form. */
export type BoundAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;

/** A server action that needs no form fields. */
export type PlainAction = (previous: ActionState) => Promise<ActionState>;
