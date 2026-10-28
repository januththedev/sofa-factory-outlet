# Writing for the chatbot

This folder holds the starting points for the files you upload in the admin panel under **Knowledge base**. It starts with an underscore, so the chatbot never reads it: these files are examples, not answers. Change the words before you upload one.

## What to upload

| File | Use it for | Template |
| --- | --- | --- |
| A Markdown file (`.md`) | A topic with several questions under it, such as delivery or fabric care | `document-template.md` |
| A JSON file (`.json`) holding a list | Questions and answers that should be answered instantly, word for word | `faqs-template.json` |
| A JSON file (`.json`) holding an object | The different words customers use for the same thing | `synonyms-template.json` |

The file name becomes the document name. Uploading `delivery.md` a second time replaces the first and keeps the old copy in the version history, so you can roll back.

## Five rules for good answers

1. **Put the answer in the first sentence.** The chatbot often reads only the start of a section. Say "Delivery takes N working days" first (with your confirmed number in place of N), then add the detail.
2. **One fact per sentence, with real numbers.** "The warranty covers the frame for N years" beats "we offer a great warranty". If a number is not confirmed, say who confirms it and when: "The team confirms the exact timing at your visit".
3. **Use the words customers actually type.** Customers write "corner sofa", "couch" and "how much", not "L-shaped sectional" or "pricing". Put those words in headings and in the other ways of asking a question. Sinhala and Tamil words, and Sinhala written in English letters, work too.
4. **One topic per heading.** Each `##` heading becomes its own piece the chatbot can find. Keep a heading to one question. Do not mix delivery and warranty under one heading.
5. **Write only what is true.** Never guess an opening hour, price, delivery time or warranty term. If you do not know, leave it out: the chatbot would rather hand the question to a person than state something wrong.

## Markdown documents

Start the file with three lines between dashes:

- `title`: the name of the document, for example `Delivery and warranty`.
- `tags`: a list in square brackets, for example `[delivery, warranty]`. Tags help the chatbot look in the right place.
- `priority`: `high`, `normal` or `low`. Use `high` for facts customers ask about every day.

Then write the document. Each `##` heading is a question or topic; the text under it is the answer. A heading line before the first `##` is not needed.

Sections longer than about 250 words are split into smaller pieces automatically, so keep answers short and put the key fact first.

## FAQ lists

Each entry has a question (`q`), other ways people ask it (`alt`), the answer (`a`) and tags. A visitor whose question is a close match is answered straight away, with no model, so the wording of `a` is exactly what they read. List at least three `alt` phrases, in the words customers use.

## Synonyms

Each key is a term. Its list holds other words customers use for the same thing. When a visitor types one of them, the search also looks for the term.

## After you upload

The admin shows a preview first and lists any mistake with its line number. After saving, press **Run the golden test again** to see whether the chatbot now finds the right facts more or less often than before. If it got worse, open the document's history and roll back.
