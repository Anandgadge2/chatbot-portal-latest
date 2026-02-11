'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { userAPI, User } from '@/lib/api/user';
import { companyAPI, Company } from '@/lib/api/company';
import { departmentAPI, Department } from '@/lib/api/department';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/permissions';
import toast from 'react-hot-toast';
import { validatePhoneNumber, validatePassword, normalizePhoneNumber } from '@/lib/utils/phoneUtils';
import { Building } from 'lucide-react';

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  editingUser?: User | null;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ isOpen, onClose, onUserCreated, editingUser }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    role: 'OPERATOR',
    companyId: '',
    departmentId: ''
  });

  // Get available roles based on current user's role
  const getAvailableRoles = (): UserRole[] => {
    if (!user) return [];
    
    const currentRole = user.role as UserRole;
    
    switch (currentRole) {
      case UserRole.SUPER_ADMIN:
        // SuperAdmin can create all roles
        return [
          UserRole.SUPER_ADMIN,
          UserRole.COMPANY_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.OPERATOR,
          UserRole.ANALYTICS_VIEWER
        ];
      case UserRole.COMPANY_ADMIN:
        // CompanyAdmin can create: COMPANY_ADMIN, DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER
        return [
          UserRole.COMPANY_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.OPERATOR,
          UserRole.ANALYTICS_VIEWER
        ];
      case UserRole.DEPARTMENT_ADMIN:
        // DepartmentAdmin can create: DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER
        return [
          UserRole.DEPARTMENT_ADMIN,
          UserRole.OPERATOR,
          UserRole.ANALYTICS_VIEWER
        ];
      case UserRole.OPERATOR:
        // Operators cannot create any users
        return [];
      default:
        return [];
    }
  };
  
  // Check if current user can create users
  const canCreateUsers = (): boolean => {
    if (!user) return false;
    const currentRole = user.role as UserRole;
    // Only SUPER_ADMIN, COMPANY_ADMIN, and DEPARTMENT_ADMIN can create users
    return [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.DEPARTMENT_ADMIN].includes(currentRole);
  };

  // Define fetchCompanies and fetchDepartments BEFORE useEffect that uses them
  const fetchCompanies = useCallback(async () => {
    try {
      const response = await companyAPI.getAll();
      if (response.success) {
        // Filter companies based on user's scope
        let filteredCompanies = response.data.companies;
        
        if (user?.role === UserRole.COMPANY_ADMIN) {
          // CompanyAdmin: only show their company
          const userCompanyId = user?.companyId 
            ? (typeof user.companyId === 'object' ? user.companyId._id : user.companyId)
            : '';
          if (userCompanyId) {
            filteredCompanies = response.data.companies.filter((company: Company) => {
              return company._id === userCompanyId;
            });
          }
        }
        // SUPER_ADMIN can see all companies (no filter)
        // DEPARTMENT_ADMIN will only see their company (handled in the select dropdown)
        
        setCompanies(filteredCompanies);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  }, [user]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.success) {
        // Filter departments based on user's scope
        let filteredDepartments = response.data.departments;
        
        if (user?.role === UserRole.COMPANY_ADMIN) {
          // CompanyAdmin: only show departments in their company
          const userCompanyId = user?.companyId 
            ? (typeof user.companyId === 'object' ? user.companyId._id : user.companyId)
            : '';
          if (userCompanyId) {
            filteredDepartments = response.data.departments.filter((dept: Department) => {
              const deptCompanyId = typeof dept.companyId === 'object' ? dept.companyId._id : dept.companyId;
              return deptCompanyId === userCompanyId;
            });
          }
        } else if (user?.role === UserRole.DEPARTMENT_ADMIN) {
          // DepartmentAdmin: only show their department
          const userDepartmentId = user?.departmentId 
            ? (typeof user.departmentId === 'object' ? user.departmentId._id : user.departmentId)
            : '';
          if (userDepartmentId) {
            filteredDepartments = response.data.departments.filter((dept: Department) => {
              return dept._id === userDepartmentId;
            });
          }
        }
        
        setDepartments(filteredDepartments);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      fetchDepartments();
      
      if (editingUser) {
        setFormData({
          firstName: editingUser.firstName || '',
          lastName: editingUser.lastName || '',
          email: editingUser.email || '',
          password: '', // Don't show password
          phone: editingUser.phone || '',
          role: editingUser.role || 'OPERATOR',
          companyId: typeof editingUser.companyId === 'object' ? editingUser.companyId?._id : (editingUser.companyId || ''),
          departmentId: typeof editingUser.departmentId === 'object' ? editingUser.departmentId?._id : (editingUser.departmentId || '')
        });
      } else {
        // Auto-select and lock company/department based on user's role
        const userCompanyId = user?.companyId 
          ? (typeof user.companyId === 'object' ? user.companyId._id : user.companyId)
          : '';
        const userDepartmentId = user?.departmentId 
          ? (typeof user.departmentId === 'object' ? user.departmentId._id : user.departmentId)
          : '';
        
        if (user?.role === UserRole.COMPANY_ADMIN && userCompanyId) {
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: '',
            role: 'OPERATOR',
            companyId: userCompanyId,
            departmentId: ''
          });
        } else if (user?.role === UserRole.DEPARTMENT_ADMIN && userCompanyId && userDepartmentId) {
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: '',
            role: 'OPERATOR',
            companyId: userCompanyId,
            departmentId: userDepartmentId
          });
        } else {
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: '',
            role: 'OPERATOR',
            companyId: '',
            departmentId: ''
          });
        }
      }
    }
  }, [isOpen, user, editingUser, fetchCompanies, fetchDepartments]);

  useEffect(() => {
    // Reset dependent fields when role changes
    if (formData.role === UserRole.COMPANY_ADMIN || formData.role === UserRole.SUPER_ADMIN) {
      setFormData(prev => ({ ...prev, departmentId: '' }));
    }
    // DEPARTMENT_ADMIN and OPERATOR need both companyId and departmentId
    // So we don't clear companyId for DEPARTMENT_ADMIN
  }, [formData.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isEditing = !!editingUser;

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Password is only required when creating a new user
    if (!isEditing && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    // Validate phone number if provided
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    // Validate password if provided
    if (formData.password && !validatePassword(formData.password)) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Role-specific validation
    if (formData.role === UserRole.SUPER_ADMIN) {
      // SuperAdmin doesn't need companyId or departmentId
    } else if (formData.role === UserRole.COMPANY_ADMIN) {
      if (!formData.companyId) {
        toast.error('Please select a company');
        return;
      }
    } else if (formData.role === UserRole.DEPARTMENT_ADMIN || formData.role === UserRole.OPERATOR || formData.role === UserRole.ANALYTICS_VIEWER) {
      if (!formData.companyId || !formData.departmentId) {
        toast.error('Please select a company and department');
        return;
      }
    }
    
    // RBAC validation
    const availableRoles = getAvailableRoles();
    if (!availableRoles.includes(formData.role as UserRole)) {
      toast.error('You do not have permission for this role');
      return;
    }

    setLoading(true);
    try {
      let response;
      const submissionData = {
        ...formData,
        companyId: formData.companyId || undefined,
        departmentId: formData.departmentId || undefined
      };

      if (isEditing) {
        // Remove password if empty
        if (!submissionData.password) {
          delete (submissionData as any).password;
        }
        response = await userAPI.update(editingUser._id, submissionData);
      } else {
        response = await userAPI.create(submissionData);
      }

      if (response.success) {
        toast.success(isEditing ? 'User updated successfully!' : 'User created successfully!');
        if (!isEditing) {
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: '',
            role: 'OPERATOR',
            companyId: '',
            departmentId: ''
          });
        }
        onClose();
        onUserCreated();
      } else {
        toast.error('Operation failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Operation failed';
      console.error('User operation error:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear department if role changes to Company Admin or SuperAdmin
    if (name === 'role' && (value === UserRole.COMPANY_ADMIN || value === UserRole.SUPER_ADMIN)) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        departmentId: ''
      }));
      return;
    }
    
    // Clear department if company changes (for DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER)
    if (name === 'companyId') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        departmentId: '' // Clear department when company changes
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;
  
  // Show error if operator tries to create users
  if (!canCreateUsers()) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-lg rounded-2xl border border-red-200/50 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-t-2xl">
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription className="text-red-100">Unable to create users</CardDescription>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-6">
              Operators are not authorized to create users. Only Super Admin, Company Admin, and Department Admin can create new users.
            </p>
            <Button onClick={onClose} className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-lg rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-t-2xl">
          <CardTitle className="text-xl">{editingUser ? 'Edit User' : 'Create New User'}</CardTitle>
          <CardDescription className="text-indigo-100">
            {editingUser ? 'Update user information' : 'Add a new user to the platform'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Min 6 characters"
                />
                {formData.password && !validatePassword(formData.password) && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    // Only allow digits, max 10
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData(prev => ({ ...prev, phone: value }));
                  }}
                  maxLength={10}
                  placeholder="10 digit number (1234567890)"
                />
                {formData.phone && !validatePhoneNumber(formData.phone) && (
                  <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
                )}
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  {getAvailableRoles().map((role) => (
                    <option key={role} value={role}>
                      {role === UserRole.SUPER_ADMIN && 'Super Admin'}
                      {role === UserRole.COMPANY_ADMIN && 'Company Admin'}
                      {role === UserRole.DEPARTMENT_ADMIN && 'Department Admin'}
                      {role === UserRole.OPERATOR && 'Operator'}
                      {role === UserRole.ANALYTICS_VIEWER && 'Analytics Viewer'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Company field - only visible for SUPER_ADMIN */}
            {/* Company Admin and Department Admin will have company auto-selected and hidden */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show company selection ONLY for Super Admin */}
              {user?.role === UserRole.SUPER_ADMIN && formData.role !== UserRole.SUPER_ADMIN && (
                <div>
                  <Label htmlFor="companyId">
                    Company {formData.role !== UserRole.SUPER_ADMIN ? '*' : ''}
                  </Label>
                  <select
                    id="companyId"
                    name="companyId"
                    value={formData.companyId}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required={formData.role !== UserRole.SUPER_ADMIN}
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Show auto-selected company info for Company Admin and Department Admin (read-only display) */}
              {(user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.DEPARTMENT_ADMIN) && formData.role !== UserRole.SUPER_ADMIN && (
                <div>
                  <Label htmlFor="companyDisplay">Company</Label>
                  <div className="w-full p-2 border rounded-md bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-700 font-medium flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-500" />
                    {companies.find(c => c._id === formData.companyId)?.name || 'Your Company'}
                    <span className="ml-auto text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">Auto-selected</span>
                  </div>
                  {/* Hidden input to keep the value */}
                  <input type="hidden" name="companyId" value={formData.companyId} />
                </div>
              )}
              
              {/* Department field - required for DEPARTMENT_ADMIN, OPERATOR, ANALYTICS_VIEWER */}
              {(formData.role === UserRole.DEPARTMENT_ADMIN || formData.role === UserRole.OPERATOR || formData.role === UserRole.ANALYTICS_VIEWER) && (
                <div>
                  <Label htmlFor="departmentId">Department *</Label>
                  {/* For Department Admin - show auto-selected department */}
                  {user?.role === UserRole.DEPARTMENT_ADMIN ? (
                    <div className="w-full p-2 border rounded-md bg-gradient-to-r from-slate-50 to-purple-50 text-slate-700 font-medium flex items-center gap-2">
                      <Building className="w-4 h-4 text-purple-500" />
                      {departments.find(d => d._id === formData.departmentId)?.name || 'Your Department'}
                      <span className="ml-auto text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">Auto-selected</span>
                    </div>
                  ) : (
                    <select
                      id="departmentId"
                      name="departmentId"
                      value={formData.departmentId}
                      onChange={handleChange}
                      className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      disabled={!formData.companyId}
                    >
                      <option value="">
                        {formData.companyId ? 'Select a department' : 'Select a company first'}
                      </option>
                      {departments
                        .filter(dept => {
                          if (!formData.companyId) return false;
                          const deptCompanyId = typeof dept.companyId === 'object' ? dept.companyId._id : dept.companyId;
                          return deptCompanyId === formData.companyId;
                        })
                        .map((department) => (
                          <option key={department._id} value={department._id}>
                            {department.name}
                          </option>
                        ))}
                    </select>
                  )}
                  {/* Hidden input for department admin */}
                  {user?.role === UserRole.DEPARTMENT_ADMIN && (
                    <input type="hidden" name="departmentId" value={formData.departmentId} />
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="px-6 border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Creating...
                  </span>
                ) : (editingUser ? 'Update User' : 'Create User')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserDialog;
