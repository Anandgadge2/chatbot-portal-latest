import { User } from '../api/user';

/**
 * Gets the displayable role label for a user.
 * Prioritizes isSuperAdmin and customRoleId over legacy role string.
 */
export function getUserRoleLabel(user: User | null | undefined): string {
  if (!user) return 'Staff';

  if (user.isSuperAdmin) return 'Super Admin';

  if (user.customRoleId && typeof user.customRoleId === 'object') {
    return (user.customRoleId as any).name || 'Staff';
  }

  // Fallback to legacy role string if it exists
  if (user.role) {
    return user.role.replace(/_/g, ' ');
  }

  return 'Staff';
}
