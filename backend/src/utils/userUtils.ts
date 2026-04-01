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
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    const customRoleKey = (a.customRoleId?.key || '').toUpperCase();
    const designation = (a.designation || '').toUpperCase();
    return customRoleKey === 'SUB_DEPARTMENT_ADMIN' || 
           customRoleName.includes('SUB DEPARTMENT') || 
           customRoleName.includes('SUB_DEPARTMENT') ||
           designation.includes('SUB-COLLECTOR') ||
           designation.includes('TAHASILDAR');
  });
  if (subDeptAdmins.length > 0) return subDeptAdmins[0];

  // 🔍 2. Filter for Department Admins
  const deptAdmins = potentialAdmins.filter(a => {
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    const customRoleKey = (a.customRoleId?.key || '').toUpperCase();
    return customRoleKey === 'DEPARTMENT_ADMIN' || 
           customRoleName.includes('DEPARTMENT');
  });
  if (deptAdmins.length > 0) return deptAdmins[0];

  // 🔍 3. Exclude Company Admins, Collectors, and Super Admins
  const filteredAdmins = potentialAdmins.filter(a => {
    const name = ((a.firstName || '') + ' ' + (a.lastName || '')).toUpperCase();
    const customRoleName = (a.customRoleId?.name || '').toUpperCase();
    const customRoleKey = (a.customRoleId?.key || '').toUpperCase();
    const designation = (a.designation || '').toUpperCase();
    
    // Strict exclusion list
    const isCompanyAdmin = customRoleKey === 'COMPANY_ADMIN' || 
                          customRoleName.includes('COMPANY ADMIN');
                          
    const isCollector = designation.includes('COLLECTOR') || 
                        designation.includes('DM') ||
                        name.includes('COLLECTOR') || 
                        customRoleName.includes('COLLECTOR') ||
                        customRoleKey.includes('COLLECTOR');
                        
    const isSuperAdmin = a.isSuperAdmin || customRoleKey === 'SUPER_ADMIN';

    // Also exclude generic "ADMIN" roles if they appear to be company-level
    // (e.g. if their departmentId is missing or they are top-level)
    const isGenericAdmin = customRoleName === 'ADMIN' || customRoleKey === 'ADMIN';
    const isTopLevel = !a.departmentId && (!a.departmentIds || a.departmentIds.length === 0);

    return !isCompanyAdmin && !isCollector && !isSuperAdmin && !(isGenericAdmin && isTopLevel);
  });

  if (filteredAdmins.length > 0) return filteredAdmins[0];

  // 🚫 Return null if only restricted users are available.
  return null;
}

