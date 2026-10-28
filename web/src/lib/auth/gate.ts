import type { NextRequest, NextResponse } from 'next/server';

// CONTRACT STUB. Owner: "auth-shell" agent. Keep this export and signature.
// Called by src/proxy.ts (owned by "seo-core") for every request. Return a
// response to short-circuit (redirect /admin/* to /admin/login/ when there is no
// session cookie), or undefined to continue. Must not import the database.
export const adminGate: (request: NextRequest) => NextResponse | undefined = () => undefined;
