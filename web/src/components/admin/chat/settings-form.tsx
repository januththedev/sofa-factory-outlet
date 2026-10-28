'use client';

import { useId, useState } from 'react';
import { saveChatSettingsAction } from '@/app/admin/(panel)/chat/actions';
import { Status } from '@/components/admin/knowledge/status';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import type { ChatSettingsView } from '@/lib/admin/chat';

type Values = {
  models: string;
  dailyModelBudget: string;
  perSessionModelAnswers: string;
  messagesPer10Min: string;
  temperature: string;
  maxTokens: string;
};

type Outcome = { tone: 'good' | 'bad'; text: string };

/** Owner only. The model list, the daily budget and the limits that keep the chatbot inside its free allowance. */
export function SettingsForm({ view }: { view: ChatSettingsView }) {
  const base = useId();
  const { settings, effectiveModels, envModels, usedToday } = view;
  const [values, setValues] = useState<Values>({
    models: effectiveModels.join('\n'),
    dailyModelBudget: String(settings.dailyModelBudget),
    perSessionModelAnswers: String(settings.perSessionModelAnswers),
    messagesPer10Min: String(settings.messagesPer10Min),
    temperature: String(settings.temperature),
    maxTokens: String(settings.maxTokens),
  });
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (field: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));
  const budget = Number(values.dailyModelBudget);
  const left = Number.isFinite(budget) ? Math.max(0, budget - usedToday) : null;
  const modelsHint = `Default from the server: ${envModels.join(', ') || 'none set'}.`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setOutcome(null);
    setFieldErrors({});
    try {
      const result = await saveChatSettingsAction(values);
      if (result.ok) {
        setOutcome({ tone: 'good', text: result.message });
      } else {
        setOutcome({ tone: 'bad', text: result.error });
        setFieldErrors(result.fieldErrors);
      }
    } catch {
      setOutcome({ tone: 'bad', text: 'The settings could not be saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Chat settings</CardTitle>
          <p className="mt-1 text-sm text-mute">
            Model answers today: <span className="font-semibold text-ink">{usedToday}</span> of{' '}
            {settings.dailyModelBudget}
            {left !== null ? ` (${left} left at the budget below)` : ''}. The count restarts at midnight in Colombo.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-5">
          <Field
            label="Models, in the order they are tried"
            htmlFor={`${base}-models`}
            hint={`One per line or comma separated. If the first fails or runs out, the next is tried. ${modelsHint}`}
            error={fieldErrors.models}
          >
            <Textarea
              id={`${base}-models`}
              value={values.models}
              onChange={set('models')}
              rows={4}
              spellCheck={false}
              className="font-mono text-sm"
              aria-invalid={Boolean(fieldErrors.models)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Daily budget (model answers)"
              htmlFor={`${base}-budget`}
              hint="After this many model answers in a day, the bot uses FAQs and templates only."
              error={fieldErrors.dailyModelBudget}
            >
              <Input
                id={`${base}-budget`}
                type="number"
                inputMode="numeric"
                min={0}
                value={values.dailyModelBudget}
                onChange={set('dailyModelBudget')}
                aria-invalid={Boolean(fieldErrors.dailyModelBudget)}
              />
            </Field>
            <Field
              label="Model answers per visit"
              htmlFor={`${base}-session`}
              hint="So one visitor cannot use the whole day."
              error={fieldErrors.perSessionModelAnswers}
            >
              <Input
                id={`${base}-session`}
                type="number"
                inputMode="numeric"
                min={0}
                value={values.perSessionModelAnswers}
                onChange={set('perSessionModelAnswers')}
                aria-invalid={Boolean(fieldErrors.perSessionModelAnswers)}
              />
            </Field>
            <Field
              label="Messages per 10 minutes"
              htmlFor={`${base}-rate`}
              hint="The most one visitor can send in ten minutes."
              error={fieldErrors.messagesPer10Min}
            >
              <Input
                id={`${base}-rate`}
                type="number"
                inputMode="numeric"
                min={1}
                value={values.messagesPer10Min}
                onChange={set('messagesPer10Min')}
                aria-invalid={Boolean(fieldErrors.messagesPer10Min)}
              />
            </Field>
            <Field
              label="Temperature"
              htmlFor={`${base}-temp`}
              hint="0 to 2. Lower is steadier and safer for facts."
              error={fieldErrors.temperature}
            >
              <Input
                id={`${base}-temp`}
                type="number"
                inputMode="decimal"
                step="0.05"
                min={0}
                max={2}
                value={values.temperature}
                onChange={set('temperature')}
                aria-invalid={Boolean(fieldErrors.temperature)}
              />
            </Field>
            <Field
              label="Max tokens per answer"
              htmlFor={`${base}-tokens`}
              hint="Longer answers cost more. 250 is about a short paragraph."
              error={fieldErrors.maxTokens}
            >
              <Input
                id={`${base}-tokens`}
                type="number"
                inputMode="numeric"
                min={16}
                value={values.maxTokens}
                onChange={set('maxTokens')}
                aria-invalid={Boolean(fieldErrors.maxTokens)}
              />
            </Field>
          </div>
          <Status tone={outcome?.tone ?? 'info'}>{outcome?.text}</Status>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
