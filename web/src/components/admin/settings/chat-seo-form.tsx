'use client';

import { saveChatSeoAction } from '@/app/admin/(panel)/settings/actions';
import type { ChatSettings, SeoSettings } from '@/lib/settings/types';
import {
  AreaField,
  CheckField,
  FormCard,
  SaveBar,
  SectionTitle,
  SelectField,
  TextField,
  useSettingsForm,
} from './form-kit';

export function ChatSeoForm({ chat, seo }: { chat: ChatSettings; seo: SeoSettings }) {
  const { state, pending, onSubmit, error } = useSettingsForm(saveChatSeoAction);
  const number = (
    name: string,
    label: string,
    value: number,
    hint?: string,
    mode: 'numeric' | 'decimal' = 'numeric',
  ) => (
    <TextField
      name={`chat.${name}`}
      label={label}
      inputMode={mode}
      defaultValue={String(value)}
      error={error(`chat.${name}`)}
      hint={hint}
    />
  );
  return (
    <FormCard onSubmit={onSubmit} aria-label="Chat and SEO switches">
      <section className="space-y-4">
        <SectionTitle title="Chatbot limits">
          These keep the chatbot inside the free OpenRouter allowance. Most answers come from FAQs and never use the
          model.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {number('dailyModelBudget', 'Model answers per day', chat.dailyModelBudget, 'Most model calls in a day.')}
          {number('bufferCalls', 'Buffer calls', chat.bufferCalls, 'Kept back so the daily limit is never hit.')}
          {number('perSessionModelAnswers', 'Model answers per visitor', chat.perSessionModelAnswers)}
          {number('messagesPer10Min', 'Messages per 10 minutes', chat.messagesPer10Min, 'Per visitor.')}
          {number('maxTokens', 'Longest answer (tokens)', chat.maxTokens)}
          {number('timeoutMs', 'Timeout (milliseconds)', chat.timeoutMs, 'How long to wait for the model.')}
          {number('temperature', 'Temperature', chat.temperature, '0 is steady, 2 is creative.', 'decimal')}
        </div>
        <AreaField
          name="chat.models"
          label="Model list override"
          defaultValue={(chat.models ?? []).join(', ')}
          error={error('chat.models')}
          rows={2}
          hint="Comma separated, tried in order. Leave empty to use the default list."
        />
      </section>

      <section className="space-y-4">
        <SectionTitle title="Search engines and AI crawlers" />
        <SelectField
          name="seo.aiCrawlers"
          label="AI crawlers (GPTBot, ClaudeBot and similar)"
          defaultValue={seo.aiCrawlers}
          error={error('seo.aiCrawlers')}
          hint="Allowing them lets AI assistants quote the site. Blocking adds them to robots.txt."
        >
          <option value="allow">Allow</option>
          <option value="block">Block</option>
        </SelectField>
        <CheckField
          name="seo.indexNow"
          label="Tell search engines at once when a page changes (IndexNow)"
          hint="Needs the IndexNow key to be configured; see Connected services below."
          defaultChecked={seo.indexNow}
        />
      </section>

      <SaveBar state={state} pending={pending} />
    </FormCard>
  );
}
