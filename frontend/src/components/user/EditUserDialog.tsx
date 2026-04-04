"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userAPI, User } from "@/lib/api/user";
import { departmentAPI, Department } from "@/lib/api/department";
import { roleAPI, Role } from "@/lib/api/role";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/lib/permissions";
import toast from "react-hot-toast";
import { User as UserIcon, Mail, MessageSquare, X, Building, Users, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
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
    designations: [] as string[], // 🏢 Added for multiple designations
    role: "OPERATOR",
    departmentIds: [] as string[], // 🏢 Added for multiple department mapping
    notificationSettings: {
      email: true,
      whatsapp: true,
      hasOverride: false
    }
  });


  const [isMultiDept, setIsMultiDept] = useState(false); // 🏢 Toggle for multiple departments
  const [selectedMainDeptId, setSelectedMainDeptId] = useState<string>("");
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string>("");
  const [customRoles, setCustomRoles] = useState<Role[]>([]);

  const fetchDepartments = useCallback(async (companyId: string) => {
    if (!companyId) return;
    try {
      const response = await departmentAPI.getAll({ companyId, listAll: true });
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
        // Filter out level 0 roles (Platform Superadmin) for company personnel
        const filteredRoles = (response.data.roles || []).filter((r: any) => r.level > 0);
        setCustomRoles(filteredRoles);
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
        designations: (user as any).designations || [], // 🏢 Added for multiple designations
        role: user.customRoleId
          ? `CUSTOM:${typeof user.customRoleId === "object" ? (user.customRoleId as any)._id : user.customRoleId}`
          : user.role || "OPERATOR",
        departmentIds: user.departmentIds?.map(d => typeof d === "object" ? (d as any)?._id : d) || [],
        notificationSettings: {
          email: user.notificationSettings?.email ?? true,
          whatsapp: user.notificationSettings?.whatsapp ?? true,
          hasOverride: (user.notificationSettings as any)?.hasOverride ?? false
        }
      });


      if (user.departmentIds && user.departmentIds.length > 0) {
        setIsMultiDept(true);
      } else {
        setIsMultiDept(false);
      }

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

  const isCompanyAdmin = () => {
    const roleName = customRoles.find(r => `CUSTOM:${r._id}` === formData.role)?.name || formData.role;
    return roleName.toLowerCase().includes("company administrator") || roleName.toLowerCase().includes("company admin");
  };

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

      const finalDeptIds = isMultiDept 
        ? formData.departmentIds 
        : (selectedSubDeptId 
            ? [selectedSubDeptId] 
            : (selectedMainDeptId && selectedMainDeptId !== "NONE" ? [selectedMainDeptId] : []));

      const submissionData: any = {
        ...formData,
        role: submissionRole,
        customRoleId: submissionCustomRoleId || undefined,
        departmentIds: finalDeptIds,
        departmentId: isMultiDept 
          ? (formData.departmentIds.length > 0 ? formData.departmentIds[0] : undefined)
          : (selectedSubDeptId || (selectedMainDeptId === "NONE" ? undefined : selectedMainDeptId) || undefined),
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
    if (!currentUser) return [];

    let filteredCustomRoles = [...customRoles];

    // Hierarchical Filtering Logic
    if (!isSuperAdmin(currentUser)) {
      const userLevel = (currentUser as any).level || 4;

      if (userLevel >= 4) {
        // Operators cannot edit anyone's role to something higher
        return [];
      } else if (userLevel === 3) {
        // 🔒 Sub-Dept Admin (Level 3) -> Operator (Level 4) ONLY
        filteredCustomRoles = customRoles.filter(r => {
          const name = r.name.toLowerCase();
          return name.includes("operator");
        });
      } else if (userLevel === 2) {
        // 🛡️ Dept Admin (Level 2) -> Sub-Dept Admin (Level 3) or Operator (Level 4)
        filteredCustomRoles = customRoles.filter(r => {
          const name = r.name.toLowerCase();
          return (
            name.includes("sub-department admin") || 
            name.includes("sub department admin") || 
            name.includes("operator")
          );
        });
      }
      // Company Admin (Level 1) can edit everything
    }

    const options: { value: string; label: string }[] = [];

    // Add ONLY filtered custom roles
    const customRoleOptions = filteredCustomRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    options.push(...customRoleOptions);

    // Keep system-level Super Admin role available for Super Admins
    if (isSuperAdmin(currentUser)) {
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
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com (Optional)"
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
                Primary Designation
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

            <div className="space-y-2 pb-2">
              <Label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest leading-none">Additional Designations</Label>
              <div className="flex gap-2">
                <Input 
                  id="edit-new-designation" 
                  placeholder="Add another title..." 
                  className="h-9 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !formData.designations.includes(val)) {
                        setFormData(prev => ({ ...prev, designations: [...prev.designations, val] }));
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const input = document.getElementById('edit-new-designation') as HTMLInputElement;
                    const val = input.value.trim();
                    if (val && !formData.designations.includes(val)) {
                      setFormData(prev => ({ ...prev, designations: [...prev.designations, val] }));
                      input.value = '';
                    }
                  }}
                >Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.designations.map((d, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-tight">
                    {d}
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, designations: prev.designations.filter((_, i) => i !== index) }))}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
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
                <SearchableSelect
                  options={getAllPossibleRoles()}
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  placeholder="Select a role"
                  className="w-full"
                />
              </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Assign Multiple Departments</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Map to multiple organizational units</p>
                  </div>
                </div>
                <Switch checked={isMultiDept} onCheckedChange={setIsMultiDept} />
              </div>

              {!isMultiDept ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="mainDepartmentId"
                      className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                    >
                      Main Department
                    </Label>
                    <SearchableSelect
                      options={[
                        ...(isCompanyAdmin() ? [{ value: "NONE", label: "🏢 FULL COMPANY (NO DEPARTMENT)" }] : []),
                        ...departments.filter(d => !d.parentDepartmentId).map(d => ({ value: d._id, label: d.name }))
                      ]}
                      value={selectedMainDeptId}
                      onValueChange={(value) => {
                        setSelectedMainDeptId(value);
                        setSelectedSubDeptId("");
                      }}
                      placeholder="No Department"
                      className="w-full"
                    />
                  </div>

                  {selectedMainDeptId && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label
                        htmlFor="subDepartmentId"
                        className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                      >
                        Sub Department (Optional)
                      </Label>
                      <SearchableSelect
                        options={departments.filter(d => {
                            const parentId = typeof d.parentDepartmentId === "object" ? (d.parentDepartmentId as any)?._id : d.parentDepartmentId;
                            return parentId === selectedMainDeptId;
                        }).map(d => ({ value: d._id, label: d.name }))}
                        value={selectedSubDeptId}
                        onValueChange={(value) => setSelectedSubDeptId(value)}
                        placeholder="None (Map to Main Department)"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <Label className="text-[10px] font-black uppercase text-indigo-500 mb-1.5 flex items-center gap-1.5 leading-none">
                          <Building className="w-3 h-3" />
                          Category Filter
                        </Label>
                        <SearchableSelect
                            options={departments.filter(d => !d.parentDepartmentId).map(d => ({ value: d._id, label: d.name }))}
                            value={selectedMainDeptId}
                            onValueChange={(val) => {
                                setSelectedMainDeptId(val);
                                setSelectedSubDeptId("");
                            }}
                            placeholder="Find Branch"
                            className="w-full bg-white"
                        />
                    </div>
                    <div>
                        <Label className="text-[10px] font-black uppercase text-indigo-500 mb-1.5 flex items-center gap-1.5 leading-none">
                          <Users className="w-3 h-3" />
                          Sub-Unit Filter
                        </Label>
                        <SearchableSelect
                            options={departments.filter(d => {
                                const pid = typeof d.parentDepartmentId === "object" ? (d.parentDepartmentId as any)?._id : d.parentDepartmentId;
                                return pid === selectedMainDeptId;
                            }).map(d => ({ value: d._id, label: d.name }))}
                            value={selectedSubDeptId}
                            onValueChange={(val) => setSelectedSubDeptId(val)}
                            placeholder="Find Specific Unit"
                            className="w-full bg-white"
                        />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Mapped Organizational Units ({formData.departmentIds.length})
                    </Label>
                    {formData.departmentIds.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setFormData(p => ({ ...p, departmentIds: [] }))}
                        className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 transition-colors"
                      >
                        [ Unmap All Units ]
                      </button>
                    )}
                  </div>

                  <div className="border rounded-xl px-2 py-2 bg-slate-50/50 max-h-[160px] overflow-y-auto custom-scrollbar space-y-1">
                    {departments.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4">No departments found</p>}
                    {departments
                      .filter(dept => {
                         if (formData.departmentIds.includes(dept._id)) return true;
                         if (!selectedMainDeptId && !selectedSubDeptId) return true;
                         
                         const isMain = dept._id === selectedMainDeptId;
                         const pid = typeof dept.parentDepartmentId === "object" ? (dept.parentDepartmentId as any)?._id : dept.parentDepartmentId;
                         const isChildOfSelectedMain = pid === selectedMainDeptId;
                         const isSelectedSub = dept._id === selectedSubDeptId;
                         
                         return isMain || isChildOfSelectedMain || isSelectedSub;
                      })
                      .map((dept) => {
                        const isSub = !!dept.parentDepartmentId;
                        const isSelected = formData.departmentIds.includes(dept._id);
                        return (
                          <div 
                            key={dept._id} 
                            className={`flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer ${isSelected ? "bg-indigo-50 border border-indigo-100 shadow-sm" : "hover:bg-white border border-transparent"}`}
                            onClick={() => {
                              setFormData(prev => {
                                const newIds = isSelected 
                                  ? prev.departmentIds.filter(id => id !== dept._id)
                                  : [...prev.departmentIds, dept._id];
                                return { ...prev, departmentIds: newIds };
                              });
                            }}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-indigo-600 border-indigo-600 shadow-sm" : "bg-white border-slate-300"}`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-[11px] font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                                {dept.name}
                              </span>
                              {isSub && (
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  Sub-Unit mapping
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

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
                        notificationSettings: { ...formData.notificationSettings, email: checked, hasOverride: true }
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
                        notificationSettings: { ...formData.notificationSettings, whatsapp: checked, hasOverride: true }
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
