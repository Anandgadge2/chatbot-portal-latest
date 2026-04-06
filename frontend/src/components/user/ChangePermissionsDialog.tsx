"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { userAPI, User } from "@/lib/api/user";
import { roleAPI, Role } from "@/lib/api/role";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserRole, isSuperAdmin } from "@/lib/permissions";
import { Shield } from "lucide-react";

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
  user,
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [customRoles, setCustomRoles] = useState<Role[]>([]);

  const fetchCustomRoles = useCallback(async (companyId: string) => {
    if (!companyId) return;
    try {
      // First try fetching ONLY company-specific roles
      let response = await roleAPI.getRoles(companyId, true);
      let roles = response.data.roles || [];

      // If no company roles exist (new company), fallback to all roles including system ones
      if (roles.length === 0) {
        response = await roleAPI.getRoles(companyId, false);
        roles = response.data.roles || [];
      }

      if (response.success) {
        setCustomRoles(roles);
      }
    } catch (error) {
      console.error("Failed to fetch custom roles:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      const initialRole = user.customRoleId
        ? `CUSTOM:${typeof user.customRoleId === "object" ? (user.customRoleId as any)._id : user.customRoleId}`
        : user.role || "";
      setSelectedRole(initialRole);

      const companyId = user?.companyId
        ? typeof user.companyId === "object"
          ? (user.companyId as any)._id
          : user.companyId
        : currentUser?.companyId
          ? typeof currentUser.companyId === "object"
            ? (currentUser.companyId as any)._id
            : currentUser.companyId
          : "";

      if (companyId) {
        fetchCustomRoles(companyId);
      }
    }
  }, [isOpen, user, currentUser, fetchCustomRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let submissionRole = selectedRole;
    let submissionCustomRoleId = "";

    if (selectedRole.startsWith("CUSTOM:")) {
      submissionRole = "CUSTOM";
      submissionCustomRoleId = selectedRole.split(":")[1];
    }

    setLoading(true);
    try {
      await userAPI.update(user._id, {
        role: submissionRole,
        customRoleId: submissionCustomRoleId || null,
      });
      toast.success("User permissions updated successfully");
      onPermissionsUpdated();
      onClose();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    } finally {
      setLoading(false);
    }
  };

  const getAllPossibleRoles = () => {
    if (!currentUser) return [];

    let filteredCustomRoles = [...customRoles];
    const creatorRoleLower = (currentUser.role || "").toLowerCase();

    // Hierarchical Filtering Logic
    if (!isSuperAdmin(currentUser)) {
      if (creatorRoleLower.includes("operator")) {
        return [];
      } else if (
        creatorRoleLower.includes("sub-department admin") ||
        creatorRoleLower.includes("sub department admin")
      ) {
        // Sub-Dept Admin can only create Sub-Dept Admin or Operator
        filteredCustomRoles = customRoles.filter((r) => {
          const name = r.name.toLowerCase();
          return (
            name.includes("sub-department admin") ||
            name.includes("sub department admin") ||
            name.includes("operator")
          );
        });
      } else if (creatorRoleLower.includes("department admin")) {
        // Dept Admin can create Dept Admin, Sub-Dept Admin, or Operator
        filteredCustomRoles = customRoles.filter((r) => {
          const name = r.name.toLowerCase();
          return (
            name.includes("department admin") ||
            name.includes("sub-department admin") ||
            name.includes("sub department admin") ||
            name.includes("operator")
          );
        });
      }
      // Company Admin (default) can see all custom roles for their company
    }

    const options: { value: string; label: string }[] = [];

    // 1. Add System Roles if current user is SuperAdmin
    if (isSuperAdmin(currentUser)) {
      options.push({ value: UserRole.SUPER_ADMIN, label: "Super Admin" });
    }

    // 2. Add Filtered Custom Roles
    const customRoleOptions = filteredCustomRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    return [...options, ...customRoleOptions];
  };

  const getRoleDescription = (role: string) => {
    if (role.startsWith("CUSTOM:")) {
      const roleId = role.split(":")[1];
      const customRole = customRoles.find((r: Role) => r._id === roleId);
      return (
        customRole?.description ||
        "Custom role with specific permissions defined for your company."
      );
    }

    const descriptions: Record<string, string> = {
      SUPER_ADMIN: "Full system access with all permissions",
    };
    return descriptions[role] || "Custom role with specific permissions defined for your company.";
  };

  if (!user) return null;

  const allPossibleRoles = getAllPossibleRoles();
  const currentRoleValue = user.customRoleId
    ? `CUSTOM:${typeof user.customRoleId === "object" ? (user.customRoleId as any)._id : user.customRoleId}`
    : user.role || "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] p-0 overflow-hidden flex flex-col border-0 shadow-2xl rounded-2xl">
        <DialogHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-lg flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-white text-xl">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            Change User Permissions
          </DialogTitle>
          <DialogDescription className="text-purple-100 mt-2">
            Change the role and permissions for{" "}
            <span className="font-semibold text-white">
              {user.firstName} {user.lastName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="space-y-6 p-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="space-y-3">
              <Label className="text-base font-semibold text-gray-700">
                Current Role
              </Label>
              <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border-2 border-slate-200">
                <div className="font-bold text-lg text-gray-900">
                  {user.customRoleId
                    ? typeof user.customRoleId === "object"
                      ? (user.customRoleId as any).name
                      : "Custom Role"
                    : allPossibleRoles.find(
                        (r: { value: string; label: string }) =>
                          r.value === user.role,
                      )?.label || user.role}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {getRoleDescription(currentRoleValue)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="role"
                className="text-base font-semibold text-gray-700"
              >
                New Role & Permissions *
              </Label>
              <select
                id="role"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="flex h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-bold text-gray-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                required
              >
                <option value="" disabled>
                  Select a role
                </option>
                {allPossibleRoles.map((role: { value: string; label: string }) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {selectedRole && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    {getRoleDescription(selectedRole)}
                  </p>
                </div>
              )}
            </div>

            {selectedRole !== currentRoleValue && selectedRole && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium">
                  <strong>⚠️ Note:</strong> Changing the role will update all
                  permissions for this user. Make sure this is the correct role
                  assignment.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 p-6 border-t border-slate-100 flex-shrink-0">
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
              disabled={loading || selectedRole === currentRoleValue}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg"
            >
              {loading ? "Updating..." : "Update Permissions"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePermissionsDialog;
