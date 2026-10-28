'use client';

import { Field, Input, Textarea } from '@/components/ui/field';

/** What the four text fields of an FAQ hold while it is being written. Lists are one per line or comma separated. */
export type FaqDraft = { question: string; alternatives: string; answer: string; tags: string };

/** The question, alternatives, answer and tags fields shared by the FAQ dialog, the gap form and the chat flag form. */
export function FaqFields({
  idBase,
  value,
  onChange,
  errors,
}: {
  idBase: string;
  value: FaqDraft;
  onChange: (next: FaqDraft) => void;
  errors: Record<string, string>;
}) {
  const set = (field: keyof FaqDraft, text: string) => onChange({ ...value, [field]: text });
  return (
    <>
      <Field label="Question" htmlFor={`${idBase}-q`} error={errors.question}>
        <Input autoComplete="off" enterKeyHint="next"
          id={`${idBase}-q`}
          value={value.question}
          onChange={(event) => set('question', event.target.value)}
          aria-invalid={Boolean(errors.question)}
          required
        />
      </Field>
      <Field
        label="Other ways people ask it"
        htmlFor={`${idBase}-alt`}
        hint="One per line. Use the words customers actually type."
        error={errors.alternatives}
      >
        <Textarea autoComplete="off" enterKeyHint="enter"
          id={`${idBase}-alt`}
          value={value.alternatives}
          onChange={(event) => set('alternatives', event.target.value)}
          rows={4}
          aria-invalid={Boolean(errors.alternatives)}
        />
      </Field>
      <Field
        label="Answer"
        htmlFor={`${idBase}-a`}
        hint="Put the answer in the first sentence."
        error={errors.answer}
      >
        <Textarea autoComplete="off" enterKeyHint="enter"
          id={`${idBase}-a`}
          value={value.answer}
          onChange={(event) => set('answer', event.target.value)}
          rows={5}
          aria-invalid={Boolean(errors.answer)}
          required
        />
      </Field>
      <Field
        label="Tags"
        htmlFor={`${idBase}-tags`}
        hint="Comma separated, for example store_info, delivery."
        error={errors.tags}
      >
        <Input autoComplete="off" enterKeyHint="next"
          id={`${idBase}-tags`}
          value={value.tags}
          onChange={(event) => set('tags', event.target.value)}
          aria-invalid={Boolean(errors.tags)}
        />
      </Field>
    </>
  );
}
