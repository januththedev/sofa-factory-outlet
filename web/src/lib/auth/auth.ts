import 'server-only';
import NextAuth from 'next-auth';
import { authConfig } from './config';

// The one place next-auth is instantiated. The rest of the app goes through
// session.ts, actions.ts and gate.ts and never imports this file directly.
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
