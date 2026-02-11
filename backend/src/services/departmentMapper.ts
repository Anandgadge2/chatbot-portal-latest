import Department from '../models/Department';
import mongoose from 'mongoose';

// Map complaint categories to department names
const CATEGORY_TO_DEPARTMENT: Record<string, string[]> = {
  'health': ['health', 'medical', 'hospital', 'clinic', 'doctor'],
  'education': ['education', 'school', 'college', 'university', 'teacher'],
  'water': ['water', 'supply', 'drinking'],
  'electricity': ['electricity', 'power', 'electric'],
  'road': ['road', 'street', 'highway', 'pothole'],
  'sanitation': ['sanitation', 'garbage', 'waste', 'cleanliness'],
  'housing': ['housing', 'house', 'home', 'residence'],
  'employment': ['employment', 'job', 'work', 'employment'],
  'finance': ['finance', 'financial', 'money', 'bank'],
  'others': ['others', 'other', 'miscellaneous']
};

// Find department by category
export async function findDepartmentByCategory(
  companyId: mongoose.Types.ObjectId,
  category: string
): Promise<mongoose.Types.ObjectId | null> {
  try {
    const normalizedCategory = category.toLowerCase().trim();
    
    // Find matching department names
    const matchingKeywords = CATEGORY_TO_DEPARTMENT[normalizedCategory] || [normalizedCategory];
    
    // Search for department by name (case-insensitive)
    const department = await Department.findOne({
      companyId,
      isActive: true,
      $or: matchingKeywords.map(keyword => ({
        name: { $regex: new RegExp(keyword, 'i') }
      }))
    });

    if (department) {
      return department._id;
    }

    // If no exact match, try to find a department with similar name
    const allDepartments = await Department.find({
      companyId,
      isActive: true
    });

    // Find best match
    for (const dept of allDepartments) {
      const deptName = dept.name.toLowerCase();
      if (matchingKeywords.some(keyword => deptName.includes(keyword))) {
        return dept._id;
      }
    }

    // If still no match, return first active department or null
    const firstDept = await Department.findOne({
      companyId,
      isActive: true
    });

    return firstDept?._id || null;

  } catch (error: any) {
    console.error('❌ Error finding department by category:', error);
    return null;
  }
}

// Get all available complaint categories for a company
export async function getAvailableCategories(companyId: mongoose.Types.ObjectId): Promise<string[]> {
  try {
    const departments = await Department.find({
      companyId,
      isActive: true
    });

    // Extract categories from department names
    const categories: string[] = [];
    const categoryMap: Record<string, boolean> = {};

    departments.forEach((dept: any) => {
      const deptName = dept.name.toLowerCase();
      for (const [category, keywords] of Object.entries(CATEGORY_TO_DEPARTMENT)) {
        if (keywords.some(keyword => deptName.includes(keyword)) && !categoryMap[category]) {
          categories.push(category);
          categoryMap[category] = true;
        }
      }
    });

    // Always include "Others"
    if (!categoryMap['others']) {
      categories.push('others');
    }

    return categories;

  } catch (error: any) {
    console.error('❌ Error getting available categories:', error);
    return ['health', 'education', 'water', 'electricity', 'road', 'sanitation', 'others'];
  }
}
