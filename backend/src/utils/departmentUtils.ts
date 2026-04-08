import Department from '../models/Department';

/**
 * Recursively find all sub-department IDs for a given department or list of departments.
 * @param departmentId The root department ID or an array of IDs to start from.
 * @returns An array of department IDs (including the roots).
 */
export async function getDepartmentHierarchyIds(departmentId: string | string[]): Promise<string[]> {
  const rootIds = Array.isArray(departmentId) ? departmentId : [departmentId];
  const allIds = new Set<string>(rootIds.filter(Boolean));
  let currentLevelIds = [...allIds];

  while (currentLevelIds.length > 0) {
    const children = await Department.find({ 
      parentDepartmentId: { $in: currentLevelIds } 
    }).select('_id');
    
    currentLevelIds = [];
    for (const child of children) {
      const childId = child._id.toString();
      if (!allIds.has(childId)) {
        allIds.add(childId);
        currentLevelIds.push(childId);
      }
    }
  }

  return Array.from(allIds);
}

