import Department from '../models/Department';
import mongoose from 'mongoose';

// Find department by exact name or category string match
export async function findDepartmentByCategory(
  companyId: mongoose.Types.ObjectId,
  category: string
): Promise<mongoose.Types.ObjectId | null> {
  try {
    const normalizedCategory = category.toLowerCase().trim();
    
    // Search for department by name (case-insensitive)
    const department = await Department.findOne({
      companyId,
      isActive: true,
      name: { $regex: new RegExp(`^${normalizedCategory}$`, 'i') }
    });

    if (department) {
      return department._id;
    }

    // Fallback: search for name containing the category
    const similarDept = await Department.findOne({
      companyId,
      isActive: true,
      name: { $regex: new RegExp(normalizedCategory, 'i') }
    });

    return similarDept?._id || null;

  } catch (error: any) {
    console.error('❌ Error finding department by name:', error);
    return null;
  }
}

// Get all available department names as categories for a company
export async function getAvailableCategories(companyId: mongoose.Types.ObjectId): Promise<string[]> {
  try {
    const departments = await Department.find({
      companyId,
      isActive: true
    }).select('name').lean();

    const categories = departments.map((dept: any) => dept.name);

    if (!categories.includes('Others') && !categories.includes('others')) {
      categories.push('Others');
    }

    return categories;

  } catch (error: any) {
    console.error('❌ Error getting available categories:', error);
    return ['Others'];
  }
}
