import Department from '../models/Department';

/**
 * Recursively find all sub-department IDs for a given department or list of departments.
 * @param departmentId The root department ID or an array of IDs to start from.
 * @returns An array of department IDs (including the roots).
 */
export async function getDepartmentHierarchyIds(departmentId: string | string[]): Promise<string[]> {
  const rootIds = Array.isArray(departmentId) ? departmentId : [departmentId];
  const ids: string[] = [...rootIds];
  
  const findChildren = async (parentId: string) => {
    const children = await Department.find({ parentDepartmentId: parentId }).select('_id');
    for (const child of children) {
      const childId = child._id.toString();
      if (!ids.includes(childId)) {
        ids.push(childId);
        await findChildren(childId);
      }
    }
  };

  for (const rootId of rootIds) {
    if (rootId) await findChildren(rootId);
  }
  return ids;
}

