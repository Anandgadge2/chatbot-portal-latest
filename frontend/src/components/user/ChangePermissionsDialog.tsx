'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { userAPI, User } from '@/lib/api/user';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserRole } from '@/lib/permissions';
import { Shield } from 'lucide-react';

interface ChangePermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated: () => void;
  user: User | null;
}

const ChangePermissionsDialog: React.FC<ChangePermissionsDialogProps> = ({ 
  isOpen, 
  onClose, 
  onPermissionsUpdated, 
  user 
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRole(user.role || 'OPERATOR');
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedRole === user.role) {
      toast.error('User already has this role');
      return;
    }

    setLoading(true);
    try {
      await userAPI.update(user._id, { role: selectedRole });
      toast.success('User permissions updated successfully');
      onPermissionsUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableRoles = () => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      return [
        { value: 'SUPER_ADMIN', label: 'Super Admin' },
        { value: 'COMPANY_ADMIN', label: 'Company Admin' },
        { value: 'DEPARTMENT_ADMIN', label: 'Department Admin' },
        { value: 'OPERATOR', label: 'Operator' },
        { value: 'ANALYTICS_VIEWER', label: 'Analytics Viewer' }
      ];
    } else if (currentUser?.role === 'COMPANY_ADMIN') {
      return [
        { value: 'DEPARTMENT_ADMIN', label: 'Department Admin' },
        { value: 'OPERATOR', label: 'Operator' },
        { value: 'ANALYTICS_VIEWER', label: 'Analytics Viewer' }
      ];
    } else if (currentUser?.role === 'DEPARTMENT_ADMIN') {
      return [
        { value: 'DEPARTMENT_ADMIN', label: 'Department Admin' },
        { value: 'OPERATOR', label: 'Operator' },
        { value: 'ANALYTICS_VIEWER', label: 'Analytics Viewer' }
      ];
    }
    return [];
  };

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      'SUPER_ADMIN': 'Full system access with all permissions',
      'COMPANY_ADMIN': 'Manage company, departments, users, grievances, and appointments',
      'DEPARTMENT_ADMIN': 'Manage department, users, and assigned grievances/appointments',
      'OPERATOR': 'Can only update status and add comments to assigned items',
      'ANALYTICS_VIEWER': 'View-only access to analytics and reports'
    };
    return descriptions[role] || 'No description available';
  };

  if (!user) return null;

  const availableRoles = getAvailableRoles();
  const currentRoleInfo = availableRoles.find(r => r.value === user.role);
  const selectedRoleInfo = availableRoles.find(r => r.value === selectedRole);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 -m-6 mb-4 rounded-t-lg">
          <DialogTitle className="flex items-center gap-3 text-white text-xl">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            Change User Permissions
          </DialogTitle>
          <DialogDescription className="text-purple-100 mt-2">
            Change the role and permissions for <span className="font-semibold text-white">{user.firstName} {user.lastName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-700">Current Role</Label>
              <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border-2 border-slate-200">
                <div className="font-bold text-lg text-gray-900">
                  {currentRoleInfo?.label || user.role}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {getRoleDescription(user.role)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="role" className="text-base font-semibold text-gray-700">New Role *</Label>
              <select
                id="role"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="flex h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                required
              >
                {availableRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {selectedRoleInfo && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    {getRoleDescription(selectedRole)}
                  </p>
                </div>
              )}
            </div>

            {selectedRole !== user.role && selectedRole && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium">
                  <strong>⚠️ Note:</strong> Changing the role will update all permissions for this user. 
                  Make sure this is the correct role assignment.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
              className="px-6 py-2 border-2 border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || selectedRole === user.role}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg"
            >
              {loading ? 'Updating...' : 'Update Permissions'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePermissionsDialog;
