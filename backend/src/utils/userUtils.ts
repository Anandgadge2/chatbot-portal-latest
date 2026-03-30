import { UserRole } from '../config/constants';

/**
 * 🎯 Finds the most suitable admin for auto-assignment.
 * Priority: 
 * 1. Sub-Department Admin
 * 2. Department Admin
 * 3. Any other non-Collector/non-Company Admin
 * 
 * Returns null if only Company Admins or Collectors are found.
 */
export function findOptimalAdmin(potentialAdmins: any[]): any | null {
  if (!potentialAdmins || potentialAdmins.length === 0) return null;

  // 🔍 1. Filter for Sub-Department Admins
  const subDeptAdmins = potentialAdmins.filter(a => {
    const role = (a.role || '').toUpperCase();
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    return role.includes('SUB_DEPARTMENT_ADMIN') || 
           role.includes('SUB DEPARTMENT') || 
           customRoleName.includes('SUB DEPARTMENT') ||
           customRoleName.includes('SUB_DEPARTMENT');
  });
  if (subDeptAdmins.length > 0) return subDeptAdmins[0];

  // 🔍 2. Filter for Department Admins
  const deptAdmins = potentialAdmins.filter(a => {
    const role = (a.role || '').toUpperCase();
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    return role.includes('DEPARTMENT_ADMIN') || 
           role.includes('DEPARTMENT') ||
           customRoleName.includes('DEPARTMENT');
  });
  if (deptAdmins.length > 0) return deptAdmins[0];

  // 🔍 3. Exclude Company Admins and Collectors
  const filteredAdmins = potentialAdmins.filter(a => {
    const role = (a.role || '').toUpperCase();
    const name = ((a.firstName || '') + ' ' + (a.lastName || '')).toUpperCase();
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    
    const isCompanyAdmin = role.includes('COMPANY_ADMIN') || customRoleName.includes('COMPANY ADMIN');
    const isCollector = role.includes('COLLECTOR') || name.includes('COLLECTOR') || customRoleName.includes('COLLECTOR');
    const isSuperAdmin = role.includes('SUPER_ADMIN');

    return !isCompanyAdmin && !isCollector && !isSuperAdmin;
  });

  if (filteredAdmins.length > 0) return filteredAdmins[0];

  // 🚫 Return null if only restricted users are available.
  // This forces manual assignment instead of "spamming" the Collector.
  return null;
}
