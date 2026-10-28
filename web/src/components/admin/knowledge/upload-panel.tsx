'use client';

import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { previewKnowledgeAction, saveUploadAction } from '@/app/admin/(panel)/knowledge/actions';
import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvalView, KnowledgePreview, LineError, SaveResult } from '@/lib/admin/knowledge';
import { cn } from '@/lib/cn';
import { ChunkPreview } from './chunk-preview';
import { ErrorList, Status } from './status';

type Saved = Extract<SaveResult, { ok: true }>;

type Stage =
  | { name: 'idle' }
  | { name: 'invalid'; fileName: string; errors: LineError[] }
  | { name: 'preview'; fileName: string; text: string; preview: KnowledgePreview }
  | { name: 'saved'; fileName: string; result: Saved };

function SavedMessage({ fileName, result }: { fileName: string; result: Saved }) {
  if (result.unchanged) {
    return (
      <>
        No changes: {fileName} is identical to version {result.version}.
      </>
    );
  }
  const extras = [
    result.faqs > 0 ? `${result.faqs} FAQs added or updated` : null,
    result.synonyms > 0 ? `${result.synonyms} synonym terms added or updated` : null,
  ].filter(Boolean);
  return (
    <>
      Saved {fileName} as version {result.version} with {result.chunks} chunks
      {extras.length > 0 ? `, ${extras.join(', ')}` : ''}. The bot uses it from its next message.
    </>
  );
}

function PreviewSummary({ preview }: { preview: KnowledgePreview }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="font-semibold">{preview.contentType}:</span> {preview.title}
      </p>
      {preview.kind === 'md' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-mute">Tags</span>
          {preview.tags.length > 0 ? (
            preview.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-mute">none</span>
          )}
          <span className="ml-2 text-mute">Priority</span>
          <Badge tone={preview.priority === 'high' ? 'maroon' : 'neutral'}>{preview.priority}</Badge>
        </div>
      ) : null}
      {preview.faqs > 0 ? (
        <p>{preview.faqs} questions will be added to the FAQs, or updated if they already exist.</p>
      ) : null}
      {preview.synonyms > 0 ? <p>{preview.synonyms} synonym terms will be added or updated.</p> : null}
      <p className="text-mute">
        {preview.currentVersion === null
          ? `A new document called ${preview.slug}.`
          : `This replaces version ${preview.currentVersion} of ${preview.slug}. The old version stays in the history.`}
      </p>
    </div>
  );
}

/**
 * Drag and drop (or choose) a .md / .json file. Nothing is saved until the preview, which shows the chunks as
 * the bot will see them, has been checked and confirmed.
 */
export function UploadPanel({
  maxBytes,
  lastEval,
  heading = 'Upload a knowledge file',
  help = 'Markdown (.md) with front matter for documents, or JSON (.json) for FAQs and synonyms. Up to 1 MB.',
  only,
}: {
  maxBytes: number;
  lastEval: EvalView | null;
  heading?: string;
  help?: string;
  only?: 'json';
}) {
  const inputId = useId();
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    const allowed = only === 'json' ? /\.json$/i : /\.(md|json)$/i;
    const fail = (message: string) => setStage({ name: 'invalid', fileName: file.name, errors: [{ message }] });
    if (!allowed.test(file.name)) {
      fail(only === 'json' ? 'Choose a .json file.' : 'Choose a .md or .json file.');
      return;
    }
    if (file.size > maxBytes) {
      fail('The file is larger than 1 MB.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const response = await previewKnowledgeAction({ fileName: file.name, text });
      if (response.ok) setStage({ name: 'preview', fileName: file.name, text, preview: response.preview });
      else setStage({ name: 'invalid', fileName: file.name, errors: response.errors });
    } catch {
      fail('The file could not be checked. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (stage.name !== 'preview') return;
    setBusy(true);
    try {
      const result = await saveUploadAction({ fileName: stage.fileName, text: stage.text });
      if (result.ok) setStage({ name: 'saved', fileName: stage.fileName, result });
      else setStage({ name: 'invalid', fileName: stage.fileName, errors: result.errors });
    } catch {
      setStage({
        name: 'invalid',
        fileName: stage.fileName,
        errors: [{ message: 'The file could not be saved. Please try again.' }],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{heading}</CardTitle>
          <p className="mt-1 text-sm text-mute">{help}</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void choose(event.dataTransfer.files[0]);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center',
            'transition-colors focus-within:border-maroon motion-reduce:transition-none',
            dragging ? 'border-maroon bg-maroon/5' : 'border-line bg-bone/40 hover:border-maroon',
          )}
        >
          <Upload className="size-6 text-maroon" aria-hidden="true" />
          <span className="font-semibold">Drop a file here, or choose one</span>
          <span className="text-sm text-mute">{only === 'json' ? '.json' : '.md or .json'}, up to 1 MB</span>
          <input
            id={inputId}
            type="file"
            accept={only === 'json' ? '.json,application/json' : '.md,.json,text/markdown,application/json'}
            className="sr-only"
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <Status>{busy ? 'Working on it…' : null}</Status>
        {stage.name === 'invalid' ? (
          <ErrorList errors={stage.errors} title={`${stage.fileName} cannot be used yet. Please fix:`} />
        ) : null}
        {stage.name === 'preview' ? (
          <div className="space-y-4">
            <PreviewSummary preview={stage.preview} />
            <ChunkPreview chunks={stage.preview.chunks} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={save} disabled={busy}>
                {stage.preview.currentVersion === null
                  ? 'Save document'
                  : `Save as version ${stage.preview.currentVersion + 1}`}
              </Button>
              <Button variant="ghost" onClick={() => setStage({ name: 'idle' })} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {stage.name === 'saved' ? (
          <div className="space-y-4">
            <Status tone="good">
              <SavedMessage fileName={stage.fileName} result={stage.result} />
            </Status>
            <div className="rounded-xl border border-line p-4">
              <p className="mb-3 font-semibold">Did relevance go up or down?</p>
              <GoldenRunner initial={lastEval} />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
