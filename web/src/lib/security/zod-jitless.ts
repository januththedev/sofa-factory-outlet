import { z } from 'zod';

// Zod builds its object parsers with `new Function`, and first tests that eval is allowed. The
// Content-Security-Policy forbids eval (see csp.ts), so in the browser that test is refused and shows up
// as a policy violation in the console. With jitless set, Zod skips the test and uses its plain parsers.
// Import this before the first schema is created: the choice is made when a schema is built.
z.config({ jitless: true });
