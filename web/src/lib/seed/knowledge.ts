import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import * as s from '../db/schema';
import { ingestDocumentWithDb } from '../kb/index';

/** Loads the starter knowledge pack without overwriting admin-edited documents. */
export async function seedKnowledge(db: Db, log: (message: string) => void = () => {}): Promise<void> {
  const folder = path.join(process.cwd(), 'content', 'knowledge');
  let names: string[];
  try {
    names = await fs.readdir(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log('Knowledge folder is missing; skipping starter knowledge.');
      return;
    }
    throw error;
  }
  const files = names
    .filter((name) => !name.startsWith('_') && !/^readme(?:\.|$)/i.test(name))
    .filter((name) => /\.(?:md|json)$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  if (files.length === 0) {
    log('Knowledge folder is empty; no starter knowledge to load.');
    return;
  }
  for (const name of files) {
    const extension = path.extname(name).toLowerCase();
    const slug = path.basename(name, extension);
    const [current] = await db.select({ editedInAdmin: s.kbDocuments.editedInAdmin })
      .from(s.kbDocuments)
      .where(and(eq(s.kbDocuments.slug, slug), eq(s.kbDocuments.isCurrent, true)))
      .limit(1);
    if (current?.editedInAdmin) {
      log(`Skipped starter knowledge ${name}: edited in admin.`);
      continue;
    }
    const text = await fs.readFile(path.join(folder, name), 'utf8');
    const result = await ingestDocumentWithDb(db, {
      slug,
      kind: extension === '.md' ? 'md' : 'json',
      text,
      source: 'starter',
    });
    if (result.ok) {
      log(`Loaded starter knowledge ${name} (version ${result.version}).`);
    } else {
      log(`Skipped invalid starter knowledge ${name}: ${result.errors.map((item) => item.message).join('; ')}`);
    }
  }
}
