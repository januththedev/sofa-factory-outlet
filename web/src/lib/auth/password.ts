import bcrypt from 'bcryptjs';

const COST = 12;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, COST);

/** Never throws: a malformed or missing hash simply fails the check. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * A genuine cost-12 bcrypt hash of a random string that was thrown away. It is
 * compared against when an email is unknown or inactive, so a failed sign-in
 * costs the same time whether or not the account exists. It must stay exactly
 * 60 characters: bcryptjs rejects any other length instantly, which would turn
 * the timing back into an "is this email registered?" oracle.
 */
export const DUMMY_HASH = '$2b$12$gkKmU..16hWB6BrNkuFVRO3cZFzPq45HNvy6sN/ZFrrGOHVgAav2O';
