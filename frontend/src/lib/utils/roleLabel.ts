export function formatRoleLabel(role?: string): string {
  if (!role) return '';

  const normalized = role.trim().toUpperCase();
  const aliases: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    COMPANY_ADMIN: 'Company Admin',
    ADMIN: 'Company Admin',
    COMPANY_HEAD: 'Company Admin',
    HEAD: 'Company Admin'
  };

  if (aliases[normalized]) return aliases[normalized];

  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
