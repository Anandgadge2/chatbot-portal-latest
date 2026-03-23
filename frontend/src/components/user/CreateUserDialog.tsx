"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { userAPI, User } from "@/lib/api/user";
import { companyAPI, Company } from "@/lib/api/company";
import { departmentAPI, Department } from "@/lib/api/department";
import { roleAPI, Role } from "@/lib/api/role";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole, UserRoleType, Permission, hasPermission, isSuperAdmin } from "@/lib/permissions";
import toast from "react-hot-toast";
import {
  validatePhoneNumber,
  validatePassword,
  normalizePhoneNumber,
  denormalizePhoneNumber,
} from "@/lib/utils/phoneUtils";
import { Building, Users, Mail, MessageSquare, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  editingUser?: User | null;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  isOpen,
  onClose,
  onUserCreated,
  editingUser,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customRoles, setCustomRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    designation: "",
    role: "Select Role", // Now stores "STATIC:ROLE" or "CUSTOM:ID"
    companyId: "",
    departmentId: "",
    notificationSettings: {
      email: true,
      whatsapp: true
    }
  });

  const [selectedMainDeptId, setSelectedMainDeptId] = useState<string>("");
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string>("");

  // Get available roles based on current user's role
  const getAllPossibleRoles = () => {
    if (!user) return [];

    const options: { value: string; label: string }[] = [];

    // Add ONLY custom roles fetched from backend (created by Superadmin for this company)
    const customRoleOptions = customRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    options.push(...customRoleOptions);

    // Special case: Only Super Admin can assign the Super Admin role
    // This is a system-level role, not a company-level custom role
    if (isSuperAdmin(user)) {
      options.push({ value: "SUPER_ADMIN", label: "Super Admin" });
    }

    return options;
  };

  const canCreateUsers = (): boolean => {
    if (!user) return false;
    // Only SUPER_ADMIN and users with specific CREATE_USER permission can create users
    return isSuperAdmin(user) || hasPermission(user, Permission.CREATE_USER);
  };

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await companyAPI.getAll();
      if (response.success) {
        let filteredCompanies = response.data.companies;
        if (!isSuperAdmin(user)) {
          const userCompanyId = user?.companyId
            ? typeof user.companyId === "object"
              ? user.companyId._id
              : user.companyId
            : "";
          if (userCompanyId) {
            filteredCompanies = response.data.companies.filter(
              (company: Company) => company._id === userCompanyId
            );
          }
        }
        setCompanies(filteredCompanies);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    }
  }, [user]);

  const fetchDepartments = useCallback(async (companyId?: string) => {
    try {
      const response = await departmentAPI.getAll({ companyId, limit: 1000 });
      if (response.success) {
        let filteredDepartments = response.data.departments;
        if (!isSuperAdmin(user)) {
          // If user is restricted to a department, scope them
          const userDeptId = user?.departmentId ? (typeof user.departmentId === "object" ? (user.departmentId as any)._id : user.departmentId) : "";
          if (userDeptId) {
            filteredDepartments = filteredDepartments.filter(
              (dept: Department) => {
                const deptId = dept._id?.toString() || dept._id;
                const parentId = typeof dept.parentDepartmentId === "object" ? (dept.parentDepartmentId as any)?._id : dept.parentDepartmentId;
                const parentIdStr = parentId?.toString() || parentId;
                return deptId === userDeptId || parentIdStr === userDeptId;
              }
            );
          }
        }

        setDepartments(filteredDepartments);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  }, [user]);

  const fetchCustomRoles = useCallback(async (companyId: string) => {
    if (!companyId) {
      setCustomRoles([]);
      return;
    }
    try {
      const response = await roleAPI.getRoles(companyId);
      if (response.success) {
        setCustomRoles(response.data.roles);
      }
    } catch (error) {
      console.error("Failed to fetch custom roles:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      fetchDepartments();

      if (editingUser) {
        setFormData({
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          email: editingUser.email || "",
          password: "",
          phone: editingUser.phone ? denormalizePhoneNumber(editingUser.phone) : "",
          designation: editingUser.designation || "",
          role: editingUser.customRoleId
            ? `CUSTOM:${typeof editingUser.customRoleId === "object" ? (editingUser.customRoleId as any)._id : editingUser.customRoleId}`
            : editingUser.role || "",
          companyId: typeof editingUser.companyId === "object" ? editingUser.companyId?._id : editingUser.companyId || "",
          departmentId: typeof editingUser.departmentId === "object" ? editingUser.departmentId?._id : editingUser.departmentId || "",
          notificationSettings: {
            email: editingUser.notificationSettings?.email ?? true,
            whatsapp: editingUser.notificationSettings?.whatsapp ?? true
          }
        });
      } else {
        const userCompanyId = user?.companyId ? (typeof user.companyId === "object" ? user.companyId._id : user.companyId) : "";
        const userDepartmentId = user?.departmentId ? (typeof user.departmentId === "object" ? user.departmentId._id : user.departmentId) : "";

        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          phone: "",
          designation: "",
          role: "",
          companyId: userCompanyId || "",
          departmentId: userDepartmentId || "",
          notificationSettings: {
            email: true,
            whatsapp: true
          }
        });

        if (userCompanyId) {
          fetchDepartments(userCompanyId);
        }
      }
    }
  }, [isOpen, user, editingUser, fetchCompanies, fetchDepartments]);

  useEffect(() => {
    if (isOpen && departments.length > 0) {
        const currentDeptId = editingUser ? (typeof editingUser.departmentId === "object" ? editingUser.departmentId?._id : editingUser.departmentId) : formData.departmentId;
        if (currentDeptId) {
            const dept = departments.find(d => d._id === currentDeptId);
            if (dept) {
                const parentId = typeof dept.parentDepartmentId === "object" ? (dept.parentDepartmentId as any)?._id : dept.parentDepartmentId;
                if (parentId) {
                    setSelectedMainDeptId(parentId);
                    setSelectedSubDeptId(currentDeptId);
                } else {
                    setSelectedMainDeptId(currentDeptId);
                    setSelectedSubDeptId("");
                }
            }
        }
    }
  }, [isOpen, departments, editingUser, formData.departmentId]);

  useEffect(() => {
    if (formData.companyId) {
      fetchCustomRoles(formData.companyId);
      fetchDepartments(formData.companyId);
    } else {
      setCustomRoles([]);
      if (formData.role.startsWith("CUSTOM:")) {
        setFormData((prev) => ({ ...prev, role: "" }));
      }
    }
  }, [formData.companyId, formData.role, fetchCustomRoles, fetchDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEditing = !!editingUser;

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.role) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isEditing && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    if (formData.password && !validatePassword(formData.password)) {
      toast.error("Password must be between 6 and 8 characters");
      return;
    }

    setLoading(true);
    try {
      let submissionRole = formData.role;
      let submissionCustomRoleId = "";

      if (formData.role.startsWith("CUSTOM:")) {
        submissionRole = "";
        submissionCustomRoleId = formData.role.split(":")[1];
      }

      const submissionData = {
        ...formData,
        role: submissionRole || undefined,
        customRoleId: submissionCustomRoleId || null,
        companyId: formData.companyId || undefined,
        departmentId: selectedSubDeptId || selectedMainDeptId || undefined,
      };

      let response;
      if (isEditing) {
        if (!submissionData.password) delete (submissionData as any).password;
        response = await userAPI.update(editingUser!._id, submissionData);
      } else {
        response = await userAPI.create(submissionData);
      }

      if (response.success) {
        // 🔄 SYNC: If user is an Admin, update Department Contact Person
        const assignedDeptId = submissionData.departmentId;
        if (assignedDeptId) {
          const roleName = customRoles.find(r => `CUSTOM:${r._id}` === formData.role)?.name || formData.role;
          if (roleName.toLowerCase().includes("admin")) {
            try {
              await departmentAPI.update(assignedDeptId, {
                contactPerson: `${formData.firstName} ${formData.lastName}`,
                contactEmail: formData.email,
                contactPhone: normalizePhoneNumber(formData.phone)
              });
            } catch (syncError) {
              console.error("Failed to sync department head info:", syncError);
            }
          }
        }

        toast.success(isEditing ? "User updated successfully!" : "User created successfully!");
        onClose();
        onUserCreated();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "companyId") {
      setFormData((prev) => ({ ...prev, [name]: value, departmentId: "" }));
      setSelectedMainDeptId("");
      setSelectedSubDeptId("");
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                  {editingUser ? "Modify Personnel Profile" : "Initialize New Personnel"}
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Global Authorization Registry
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 border border-white/10 group cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="First name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="Last name" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="user@example.com" />
              </div>
              <div>
                <Label htmlFor="password">Password {editingUser ? "(Leave blank to keep current)" : "*"}</Label>
                <Input id="password" name="password" type="password" minLength={6} maxLength={8} value={formData.password} onChange={handleChange} required={!editingUser} placeholder="6-8 characters" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData(prev => ({ ...prev, phone: val }));
                }} maxLength={10} placeholder="10 digit number" />
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g. Collector & DM" />
              </div>
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 font-medium" required>
                <option value="" disabled>Select a role</option>
                {getAllPossibleRoles().map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assignment & Notifications</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            {isSuperAdmin(user) && (
                <div>
                    <Label htmlFor="companyId">Company *</Label>
                    <select id="companyId" name="companyId" value={formData.companyId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500" required>
                        <option value="">Select a company</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Main Department</Label>
                    <select value={selectedMainDeptId} onChange={(e) => {
                        setSelectedMainDeptId(e.target.value);
                        setSelectedSubDeptId("");
                    }} className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500" disabled={!formData.companyId}>
                        <option value="">{formData.companyId ? "No Department" : "Select Company First"}</option>
                        {departments.filter(d => !d.parentDepartmentId).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                </div>
                {selectedMainDeptId && (
                    <div>
                        <Label>Sub Department</Label>
                        <select value={selectedSubDeptId} onChange={(e) => setSelectedSubDeptId(e.target.value)} className="w-full p-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500">
                            <option value="">None (Map to Main)</option>
                            {departments.filter(d => {
                                const pid = typeof d.parentDepartmentId === "object" ? (d.parentDepartmentId as any)?._id : d.parentDepartmentId;
                                return pid === selectedMainDeptId;
                            }).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">Email</span>
                </div>
                <Switch checked={formData.notificationSettings.email} onCheckedChange={(checked) => setFormData(p => ({ ...p, notificationSettings: {...p.notificationSettings, email: checked} }))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">WhatsApp</span>
                </div>
                <Switch checked={formData.notificationSettings.whatsapp} onCheckedChange={(checked) => setFormData(p => ({ ...p, notificationSettings: {...p.notificationSettings, whatsapp: checked} }))} />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                {loading ? "Processing..." : (editingUser ? "Update User" : "Create User")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserDialog;
