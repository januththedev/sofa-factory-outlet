// Puts an admin account back on a default password that must be changed at the next sign-in.
//
//   npx tsx scripts/set-admin-password.ts                       list the admin accounts
//   npx tsx scripts/set-admin-password.ts <email> <password>    set it (the owner chooses their own at sign-in)
import './_env';
import { asc, sql } from 'drizzle-orm';
import { hashPassword } from '../src/lib/auth/password';
import { closeDb, getDb } from '../src/lib/db';
import * as s from '../src/lib/db/schema';

async function main() {
  const [email, password] = process.argv.slice(2);
  const db = await getDb();
  if (!email) {
    const users = await db
      .select({ name: s.adminUsers.name, email: s.adminUsers.email, role: s.adminUsers.role, active: s.adminUsers.active, must: s.adminUsers.mustChangePassword })
      .from(s.adminUsers)
      .orderBy(asc(s.adminUsers.id));
    for (const u of users) console.log(`${u.email}  ${u.name}  ${u.role}${u.active ? '' : ' (deactivated)'}${u.must ? '  must change password' : ''}`);
  } else {
    if (!password) throw new Error('Give the password after the email.');
    const updated = await db
      .update(s.adminUsers)
      .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
      .where(sql`lower(${s.adminUsers.email}) = ${email.trim().toLowerCase()}`)
      .returning({ email: s.adminUsers.email });
    console.log(updated.length ? `default password set for ${updated[0].email}; it must be changed at the next sign-in` : `no account with the email ${email}`);
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
