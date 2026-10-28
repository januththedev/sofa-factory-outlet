/** One request at a time; background tabs catch up when they become visible. */
export function pollWhenVisible(
  poll: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  { immediate = true, background = () => false }: { immediate?: boolean; background?: () => boolean } = {},
): () => void {
  const controller = new AbortController();
  let running = false;
  const refresh = async () => {
    if (controller.signal.aborted || running || (document.hidden && !background())) return;
    running = true;
    try {
      await poll(controller.signal);
    } catch {
      // Keep the last result on a network failure; the next interval retries.
    } finally {
      running = false;
    }
  };
  const onVisible = () => { if (!document.hidden) void refresh(); };
  const timer = setInterval(() => void refresh(), intervalMs);
  document.addEventListener('visibilitychange', onVisible);
  if (immediate) void refresh();
  return () => {
    controller.abort();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
