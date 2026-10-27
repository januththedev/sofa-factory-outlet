import type { Db } from '../db';

/**
 * Loads the starter knowledge pack from content/knowledge into the knowledge
 * tables. Filled in by the knowledge-base phase; a no-op until then.
 */
export async function seedKnowledge(db: Db, log: (message: string) => void = () => {}): Promise<void> {
  void db;
  void log;
}
