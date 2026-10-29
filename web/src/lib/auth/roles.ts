import type { AdminRole } from '@/lib/db/schema/types';

// The database keeps the original role keys ('owner', 'staff'); people see these names.
export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Super admin', staff: 'Admin' };

export const roleLabel = (role: AdminRole): string => ROLE_LABEL[role];
