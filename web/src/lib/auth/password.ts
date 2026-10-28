import bcrypt from 'bcryptjs';

const COST = 12;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, COST);

export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

/** A real bcrypt hash of a random string, compared against when an email is unknown so timing does not reveal which emails exist. */
export const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO8J5QqU1oQ9Ew2s9gYQmH0m0m0m0m0m0';
