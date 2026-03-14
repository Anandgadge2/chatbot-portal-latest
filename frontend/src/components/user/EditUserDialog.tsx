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
import { User as UserIcon, Mail, MessageSquare, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { denormalizePhoneNumber } from "@/lib/utils/phoneUtils";
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
    notificationSettings: {
      email: true,
      whatsapp: true
    }
  });
  const [selectedMainDeptId, setSelectedMainDeptId] = useState<string>("");
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string>("");
  const [customRoles, setCustomRoles] = useState<Role[]>([]);

  const fetchDepartments = useCallback(async (companyId: string) => {
    if (!companyId) return;
    try {
      const response = await departmentAPI.getAll({ companyId, limit: 1000 });
      setDepartments(response.data.departments || []);
    } catch (error: any) {
      console.error("Failed to fetch departments:", error);
    }
  }, []);

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
        phone: user.phone ? denormalizePhoneNumber(user.phone) : "",
        designation: user.designation || "",
        role: user.customRoleId
          ? `CUSTOM:${typeof user.customRoleId === "object" ? (user.customRoleId as any)._id : user.customRoleId}`
          : user.role || "OPERATOR",
        notificationSettings: {
          email: user.notificationSettings?.email ?? true,
          whatsapp: user.notificationSettings?.whatsapp ?? true
        }
      });

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
        fetchDepartments(companyId);
      }
    }
  }, [isOpen, user, currentUser, fetchCustomRoles, fetchDepartments]);

  useEffect(() => {
    if (isOpen && user && departments.length > 0) {
      const userDeptId = user.departmentId
        ? typeof user.departmentId === "object"
          ? (user.departmentId as any)._id
          : user.departmentId
        : "";

      if (userDeptId) {
        const dept = departments.find((d) => d._id === userDeptId);
        if (dept) {
          const parentId = typeof dept.parentDepartmentId === "object"
            ? (dept.parentDepartmentId as any)?._id
            : dept.parentDepartmentId;

          if (parentId) {
            setSelectedMainDeptId(parentId);
            setSelectedSubDeptId(userDeptId);
          } else {
            setSelectedMainDeptId(userDeptId);
            setSelectedSubDeptId("");
          }
        }
      }
    }
  }, [isOpen, user, departments]);

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
        departmentId: selectedSubDeptId || selectedMainDeptId || undefined,
      };

      await userAPI.update(user._id, submissionData);

      // 🔄 SYNC: If user is an Admin, update Department Contact Person
      const assignedDeptId = submissionData.departmentId;
      if (assignedDeptId) {
        const roleName = customRoles.find(r => `CUSTOM:${r._id}` === formData.role)?.name || formData.role;
        if (roleName.toLowerCase().includes("admin")) {
          try {
            await departmentAPI.update(assignedDeptId, {
              contactPerson: `${formData.firstName} ${formData.lastName}`,
              contactEmail: formData.email,
              contactPhone: formData.phone
            });
          } catch (syncError) {
            console.error("Failed to sync department head info:", syncError);
          }
        }
      }

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
    const options: { value: string; label: string }[] = [];

    // Add ONLY custom roles created for this company
    const customRoleOptions = customRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    options.push(...customRoleOptions);

    // Keep system-level Super Admin role available for Super Admins
    if (currentUser?.role === "SUPER_ADMIN") {
      options.push({ value: "SUPER_ADMIN", label: "Super Admin" });
    }

    return options;
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="sm:max-w-[650px] max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white p-0 border-0 flex flex-col">
        <div className="bg-slate-900 px-6 py-5 relative overflow-hidden flex-shrink-0 border-b border-slate-800">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
          <div className="relative flex items-center justify-between">
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
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 border border-white/10 group cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
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
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, phone: val });
                  }}
                  required
                  placeholder="10 digit number"
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
                  <option value="" disabled>
                    Select a role
                  </option>
                  {getAllPossibleRoles().some((r: any) =>
                    r.value.startsWith("CUSTOM:"),
                  ) && (
                    <optgroup label="Custom Roles">
                      {getAllPossibleRoles()
                        .filter((r: any) => r.value.startsWith("CUSTOM:"))
                        .map((role: { value: string; label: string }) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="mainDepartmentId"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Main Department
                </Label>
                <select
                  id="mainDepartmentId"
                  value={selectedMainDeptId}
                  onChange={(e) => {
                    setSelectedMainDeptId(e.target.value);
                    setSelectedSubDeptId(""); // Reset sub-dept when main dept changes
                  }}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                >
                  <option value="">No Department</option>
                  {departments
                    .filter((d) => !d.parentDepartmentId)
                    .map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              {selectedMainDeptId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label
                    htmlFor="subDepartmentId"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Sub Department (Optional)
                  </Label>
                  <select
                    id="subDepartmentId"
                    value={selectedSubDeptId}
                    onChange={(e) => setSelectedSubDeptId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                  >
                    <option value="">None (Map to Main Department)</option>
                    {departments
                      .filter((d) => {
                        const parentId = typeof d.parentDepartmentId === "object"
                          ? (d.parentDepartmentId as any)?._id
                          : d.parentDepartmentId;
                        return parentId === selectedMainDeptId;
                      })
                      .map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Notification Controls */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Email</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Alerts</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.notificationSettings.email}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        notificationSettings: { ...formData.notificationSettings, email: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">WhatsApp</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Alerts</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.notificationSettings.whatsapp}
                    onCheckedChange={(checked) => 
                      setFormData({
                        ...formData,
                        notificationSettings: { ...formData.notificationSettings, whatsapp: checked }
                      })
                    }
                  />
                </div>
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
