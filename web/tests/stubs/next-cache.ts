// Test stand-in for `next/cache` (see vitest.config.mts). Outside a Next request there is no
// incremental cache, so unstable_cache would throw; here caches pass straight through and
// revalidation is a no-op, which is what database and logic tests want.
export const unstable_cache = <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) => fn;
export const revalidateTag = (): void => {};
export const revalidatePath = (): void => {};
export const updateTag = (): void => {};
export const cacheTag = (): void => {};
export const cacheLife = (): void => {};
