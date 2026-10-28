'use client';

import { useId, useState } from 'react';
import { previewKnowledgeAction, saveEditAction } from '@/app/admin/(panel)/knowledge/actions';
import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/field';
import type { EvalView, KnowledgePreview, LineError, SaveResult } from '@/lib/admin/knowledge';
import { ChunkPreview } from './chunk-preview';
import { ErrorList, Status } from './status';

type Saved = Extract<SaveResult, { ok: true }>;

/**
 * Edit a document in the browser. Saving creates a new version and marks the document as edited in admin,
 * so the starter loader never overwrites it.
 */
export function DocumentEditor({
  slug,
  kind,
  initialText,
  lastEval,
}: {
  slug: string;
  kind: 'md' | 'json';
  initialText: string | null;
  lastEval: EvalView | null;
}) {
  const textId = useId();
  const [text, setText] = useState(initialText ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<LineError[]>([]);
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  if (initialText === null) {
    return (
      <p className="text-sm text-mute">
        The original file for this document was not kept, so it cannot be edited here. Upload a replacement file
        instead.
      </p>
    );
  }

  const fileName = `${slug}.${kind}`;

  async function check() {
    setBusy(true);
    setErrors([]);
    setSaved(null);
    try {
      const response = await previewKnowledgeAction({ fileName, text });
      if (response.ok) setPreview(response.preview);
      else {
        setPreview(null);
        setErrors(response.errors);
      }
    } catch {
      setErrors([{ message: 'The text could not be checked. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErrors([]);
    try {
      const result = await saveEditAction({ slug, text });
      if (result.ok) {
        setSaved(result);
        setPreview(null);
      } else {
        setErrors(result.errors);
      }
    } catch {
      setErrors([{ message: 'The changes could not be saved. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={textId}>Text of {fileName}</Label>
        <Textarea
          id={textId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(null);
          }}
          rows={22}
          spellCheck={false}
          className="font-mono text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={check} disabled={busy}>
          Check and preview
        </Button>
        <Button onClick={save} disabled={busy}>
          Save as a new version
        </Button>
      </div>
      <Status>{busy ? 'Working on it…' : null}</Status>
      {errors.length > 0 ? <ErrorList errors={errors} /> : null}
      {preview ? <ChunkPreview chunks={preview.chunks} /> : null}
      {saved ? (
        <div className="space-y-4">
          <Status tone="good">
            {saved.unchanged
              ? `Nothing changed: the text is identical to version ${saved.version}.`
              : `Saved as version ${saved.version} with ${saved.chunks} chunks. The bot uses it from its next message.`}
          </Status>
          <div className="rounded-xl border border-line p-4">
            <p className="mb-3 font-semibold">Did relevance go up or down?</p>
            <GoldenRunner initial={lastEval} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
