/** Body of a contract stub. The agent that owns the module replaces it with the real implementation. */
export function notImplemented(what: string): never {
  throw new Error(`${what} is not implemented yet`);
}
