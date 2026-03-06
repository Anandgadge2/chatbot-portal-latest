"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userAPI, User } from "@/lib/api/user";
import { departmentAPI, Department } from "@/lib/api/department";
import { roleAPI, Role } from "@/lib/api/role";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  user: User | null;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({
  isOpen,
  onClose,
  onUserUpdated,
  user,
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    designation: "",
    role: "OPERATOR",
    departmentId: "",
  });
  const [customRoles, setCustomRoles] = useState<Role[]>([]);

  const fetchDepartments = useCallback(async () => {
    try {
      const companyId = currentUser?.companyId
        ? typeof currentUser.companyId === "object"
          ? (currentUser.companyId as any)._id
          : currentUser.companyId
        : "";

      if (companyId) {
        const response = await departmentAPI.getAll({ companyId });
        setDepartments(response.data.departments || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch departments:", error);
    }
  }, [currentUser]);

  const fetchCustomRoles = useCallback(async (companyId: string) => {
    if (!companyId) return;
    try {
      const response = await roleAPI.getRoles(companyId);
      if (response.success) {
        setCustomRoles(response.data.roles || []);
      }
    } catch (error) {
      console.error("Failed to fetch custom roles:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        designation: user.designation || "",
        role: user.customRoleId
          ? `CUSTOM:${typeof user.customRoleId === "object" ? (user.customRoleId as any)._id : user.customRoleId}`
          : user.role || "OPERATOR",
        departmentId: user.departmentId
          ? typeof user.departmentId === "object"
            ? (user.departmentId as any)._id
            : user.departmentId
          : "",
      });

      const companyId = currentUser?.companyId
        ? typeof currentUser.companyId === "object"
          ? (currentUser.companyId as any)._id
          : currentUser.companyId
        : "";

      if (companyId) {
        fetchCustomRoles(companyId);
      }

      fetchDepartments();
    }
  }, [isOpen, user, currentUser, fetchCustomRoles, fetchDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let submissionRole = formData.role;
      let submissionCustomRoleId = "";

      if (formData.role.startsWith("CUSTOM:")) {
        submissionRole = "OPERATOR"; // Default base role for custom roles
        submissionCustomRoleId = formData.role.split(":")[1];
      }

      const submissionData = {
        ...formData,
        role: submissionRole,
        customRoleId: submissionCustomRoleId || undefined,
      };

      await userAPI.update(user._id, submissionData);
      toast.success("User updated successfully");
      onUserUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const getAllPossibleRoles = () => {
    let roles: { value: string; label: string }[] = [];
    
    // Add Standard Roles
    if (currentUser?.role === "SUPER_ADMIN") {
      roles.push(
        { value: "SUPER_ADMIN", label: "Super Admin" },
        { value: "COMPANY_ADMIN", label: "Company Admin" },
        { value: "DEPARTMENT_ADMIN", label: "Department Admin" },
        { value: "SUB_DEPARTMENT_ADMIN", label: "Sub Department Admin" },
        { value: "OPERATOR", label: "Operator" },
        { value: "ANALYTICS_VIEWER", label: "Analytics Viewer" }
      );
    } else if (currentUser?.role === "COMPANY_ADMIN") {
      roles.push(
        { value: "DEPARTMENT_ADMIN", label: "Department Admin" },
        { value: "SUB_DEPARTMENT_ADMIN", label: "Sub Department Admin" },
        { value: "OPERATOR", label: "Operator" },
        { value: "ANALYTICS_VIEWER", label: "Analytics Viewer" }
      );
    } else if (currentUser?.role === "DEPARTMENT_ADMIN") {
      roles.push(
        { value: "DEPARTMENT_ADMIN", label: "Department Admin" },
        { value: "SUB_DEPARTMENT_ADMIN", label: "Sub Department Admin" },
        { value: "OPERATOR", label: "Operator" },
        { value: "ANALYTICS_VIEWER", label: "Analytics Viewer" }
      );
    }

    // Add Custom Roles
    const customRoleOptions = customRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    return [...roles, ...customRoleOptions];
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white p-0 border-0 flex flex-col">
        <div className="bg-slate-900 px-6 py-5 relative overflow-hidden flex-shrink-0 border-b border-slate-800">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
          <DialogHeader className="relative">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-3 uppercase tracking-tight">
              <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <UserIcon className="w-4 h-4 text-indigo-400" />
              </div>
              Edit User
            </DialogTitle>
            <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Update staff information and access settings
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="firstName"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  placeholder="e.g. Rahul"
                  className="h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="lastName"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                  placeholder="e.g. Sharma"
                  className="h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
              >
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                placeholder="user@example.com"
                className="h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
              >
                Phone *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
                placeholder="+91 98765 43210"
                className="h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="designation"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
              >
                Designation
              </Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) =>
                  setFormData({ ...formData, designation: e.target.value })
                }
                placeholder="e.g. Collector & DM"
                className="h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Access & Assignment
              </span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="role"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Role & Permissions *
                </Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                  required
                >
                  <option value="" disabled>Select a role</option>
                  {getAllPossibleRoles().map((role: { value: string; label: string }) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="departmentId"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Department
                </Label>
                <select
                  id="departmentId"
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value })
                  }
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                >
                  <option value="">No Department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-5 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase tracking-widest shadow-md shadow-indigo-900/20 transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Updating...
                </span>
              ) : (
                "Update User"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
