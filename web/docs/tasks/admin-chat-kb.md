# Task: admin-chat-kb (admin Knowledge base and Chat pages)

Read `web/docs/BUILD-GUIDE.md` first. Spec sources in `../Plan.md`: "Knowledge files" (what happens on upload, writing guide), "Chatbot → Keeping relevance high" (playground, knowledge-gap queue, model choice), "Admin panel" (Knowledge base and Chat rows).

## You own
`src/app/admin/(panel)/knowledge/**`, `src/app/admin/(panel)/chat/**`, `src/components/admin/knowledge/**`, `src/components/admin/chat/**`, `src/lib/admin/{knowledge,chat}.ts`, `content/knowledge/_templates/**` (the writing guide and file templates for the client), `tests/db/admin-knowledge.test.ts`.

## Build (every page, action and route starts with `requireRole()` from `@/lib/auth/session`; uploads, deletes and settings changes are owner + staff, but model/embedding settings are owner-only)
You consume contracts implemented by other agents: `ingestDocument`, `searchKnowledge`, `reindexAll` (`@/lib/kb/api`, kb-core, which also exports `enableEmbeddings(model)`) and `runChat` / the eval runner in `src/lib/chat/eval.ts` (chat-pipeline: it exports `runGoldenSet(): Promise<{ total; hitAt3; intentAccuracy; answeredWithoutModel; failures: Array<{ id; question; reason }> }>`). Code against those names; catch errors and show friendly messages.

**Knowledge `/admin/knowledge/`**: tabs **Documents**, **FAQs**, **Synonyms**, **Gaps**.
- *Documents*: list (title, kind md/json, version, tags, priority, enabled switch, chunk count, updated, source starter/upload); **upload** (drag and drop `.md`/`.json`, max 1 MB, validated with Zod, then `ingestDocument`); errors are shown **line by line**; a **preview step before saving** (parse + chunk with the pure functions from `@/lib/kb/parse` and `@/lib/kb/chunk` and show the chunks exactly as the bot will see them: heading path, text, tags); version history with **roll back** (set an older version current: implement in `src/lib/admin/knowledge.ts` with a transaction: flip `isCurrent`, rebuild that document's chunks via `ingestDocument` of the stored text or by re-chunking, `revalidateTags('kb')`); enable/disable switch; an in-browser editor for starter documents (sets `editedInAdmin` so the starter loader never overwrites it); after any change offer "Run the golden test again" (calls `runGoldenSet`) and show whether relevance went up or down versus the last stored run (store the last result in `settings` key `chat_eval_last` through the settings table directly with an upsert).
- *FAQs*: table with question, alternatives, answer, tags, hit count, enabled; add/edit/delete in a dialog; bulk import via the JSON uploader; search.
- *Synonyms*: editable term → variants list (chips), import/export JSON.
- *Gaps*: the knowledge-gap queue (`knowledge_gaps`: question, times asked, status, last asked) with an inline "Write the answer" form that creates an FAQ (`source: 'gap'`, the question plus the asker's alternatives) and marks the gap `answered` with `resolvedFaqId`; dismiss; sort by times asked.
- *Embeddings (owner-only card)*: shows status, model picker (default `OPENROUTER_EMBED_MODEL` env or a typed model id), "Turn on embeddings" (`enableEmbeddings`) + "Re-index" (`reindexAll`) with progress text; explains it needs an OpenRouter key and credit and that the vector extension must exist.

**Chat `/admin/chat/`**: tabs **Conversations**, **Playground**, **Golden test**, **Settings**.
- *Conversations*: list (visitor short id, started, last message, messages, intent mix, handoff flag, thumbs-down count) with filters (handoff, thumbs-down, unanswered/low confidence), and a detail view with the transcript (each assistant message shows intent, answeredBy, confidence, model, latency, retrieved ids) and a "Flag / write FAQ" action. Handoff requests deep-link here from the bell.
- *Playground*: type a question; show the intent and extracted details, the retrieved knowledge chunks with scores, the exact prompt that would be sent, and the answer, by calling `runChat` server-side with a throwaway visitor/session and capturing events plus the debug info that chat-pipeline exposes through `explainChat(message, context): Promise<{ intent; extracted; chunks; products; prompt: string | null; answer: string; answeredBy: string }>` exported from `src/lib/chat/explain.ts` (chat-pipeline owns it; if it does not exist when you build, create nothing: write against the declared type in a local `.d.ts`-free way by importing it and handling a thrown "not implemented" error).
- *Golden test*: a "Run golden test" button calling `runGoldenSet`, results table with failures and reasons, the last run's numbers (hit@3 target ≥ 90%).
- *Settings* (owner-only): model list order (comma separated, default from `chatModels()`), daily budget, per-session answers, messages per 10 minutes, temperature, max tokens: these write the `chat` settings key (read/merge with `getSettings()`, validate with Zod, `revalidateSettings()`); show today's model calls vs budget.

**Templates** (`content/knowledge/_templates/`, not ingested because of the `_` prefix): `README.md` (the client writing guide: put the answer in the first sentence, one fact per sentence with real numbers, use the words customers actually type, one topic per heading), `document-template.md` (front matter + `##` sections example), `faqs-template.json`, `synonyms-template.json`.

## Tests
`tests/db/admin-knowledge.test.ts`: roll back to a previous version (chunks rebuilt, search reflects it), FAQ create/edit/delete, gap → FAQ conversion marks the gap answered, synonym import validation, the settings merge.

## Don't
Reimplement ingestion, retrieval or the pipeline; skip `requireRole`; add dependencies.
