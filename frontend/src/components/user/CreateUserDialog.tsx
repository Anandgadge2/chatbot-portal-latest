"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { UserRole, UserRoleType, Permission, hasPermission, isSuperAdmin, isCompanyAdminOrHigher } from "@/lib/permissions";
import toast from "react-hot-toast";
import {
  validatePhoneNumber,
  validatePassword,
  normalizePhoneNumber,
  denormalizePhoneNumber,
} from "@/lib/utils/phoneUtils";
import { Building, Users, Mail, MessageSquare, X, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user?: User) => void;
  editingUser?: User | null;
  defaultCompanyId?: string;
  hideDepartmentSelection?: boolean;
  allowedRoleKeywords?: string[];
  forceSingleDepartmentId?: string;
}

// allowedRoleNames removed to allow all custom roles to be visible and selectable.


export default function CreateUserDialog({
  isOpen,
  onClose,
  onUserCreated,
  editingUser,
  defaultCompanyId,
  hideDepartmentSelection = false,
  allowedRoleKeywords,
  forceSingleDepartmentId,
}: CreateUserDialogProps) {
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
    designations: [] as string[],
    role: "Select Role",
    companyId: "",
    departmentId: "",
    departmentIds: [] as string[],
    notificationSettings: {
      email: true,
      whatsapp: true,
      hasOverride: false
    }
  });


  const [isMultiDept, setIsMultiDept] = useState(false);

  const [selectedMainDeptId, setSelectedMainDeptId] = useState<string>("");
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string>("");

  const getAllPossibleRoles = useCallback(() => {
    if (!user) return [];

    let filteredCustomRoles = [...customRoles];
    const creatorRoleLower = (user.role || "").toLowerCase();

    if (!isSuperAdmin(user)) {
      const userLevel = (user as any).level || 4;

      if (userLevel >= 4) {
        return [];
      } else if (userLevel === 3) {
        filteredCustomRoles = customRoles.filter(r => {
          const name = r.name.toLowerCase();
          return name.includes("operator");
        });
      } else if (userLevel === 2) {
        filteredCustomRoles = customRoles.filter(r => {
          const name = r.name.toLowerCase();
          return (
            name.includes("sub-department admin") || 
            name.includes("sub department admin") || 
            name.includes("operator")
          );
        });
      }
    }

    if (allowedRoleKeywords && allowedRoleKeywords.length > 0) {
      const normalizedKeywords = allowedRoleKeywords.map((k) => k.toLowerCase());
      filteredCustomRoles = filteredCustomRoles.filter((r) =>
        normalizedKeywords.some((keyword) => r.name.toLowerCase().includes(keyword)),
      );
    }

    const options: { value: string; label: string }[] = [];

    const customRoleOptions = filteredCustomRoles.map((r) => ({
      value: `CUSTOM:${r._id}`,
      label: r.name,
    }));

    options.push(...customRoleOptions);

    if (isSuperAdmin(user)) {
      options.push({ value: UserRole.SUPER_ADMIN, label: "Super Admin" });
    }

    return options;
  }, [user, customRoles, allowedRoleKeywords]);

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
      const response = await departmentAPI.getAll({ companyId, listAll: true });
      if (response.success) {
        let filteredDepartments = response.data.departments;
        if (!isSuperAdmin(user)) {
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
      let response = await roleAPI.getRoles(companyId, true);
      let roles = response.data.roles || [];

      if (roles.length === 0) {
        response = await roleAPI.getRoles(companyId, false);
        roles = response.data.roles || [];
      }

      if (response.success) {
        const filteredRoles = roles.filter(
          (r: any) => {
            // Keep all roles except Platform Superadmin (level 0) for user creation
            return r.level !== 0;
          }
        );
        setCustomRoles(filteredRoles);
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
          designations: (editingUser as any).designations || [],
          role: editingUser.customRoleId
            ? `CUSTOM:${typeof editingUser.customRoleId === "object" ? (editingUser.customRoleId as any)._id : editingUser.customRoleId}`
            : editingUser.role || "",
          companyId: typeof editingUser.companyId === "object" ? editingUser.companyId?._id : editingUser.companyId || "",
          departmentId: typeof editingUser.departmentId === "object" ? editingUser.departmentId?._id : editingUser.departmentId || "",
          departmentIds: editingUser.departmentIds?.map(d => typeof d === "object" ? (d as any)?._id : d) || [],
          notificationSettings: {
            email: editingUser.notificationSettings?.email ?? true,
            whatsapp: editingUser.notificationSettings?.whatsapp ?? true,
            hasOverride: (editingUser.notificationSettings as any)?.hasOverride ?? false
          }
        });

        if (editingUser.departmentIds && editingUser.departmentIds.length > 0) {
          setIsMultiDept(true);
        }
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
          designations: [],
          role: "",
          companyId: defaultCompanyId || userCompanyId || "",
          departmentId: userDepartmentId || "",
          departmentIds: [],
          notificationSettings: {
            email: true,
            whatsapp: true,
            hasOverride: false
          }
        });

        setIsMultiDept(false);
        const effectiveCompanyId = defaultCompanyId || userCompanyId;
        if (effectiveCompanyId) {
          fetchDepartments(effectiveCompanyId);
        }
      }
    }
  }, [isOpen, user, editingUser, fetchCompanies, fetchDepartments, defaultCompanyId]);

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

  const isCompanyAdmin = () => {
    const roleName = customRoles.find(r => `CUSTOM:${r._id}` === formData.role)?.name || formData.role;
    return roleName.toLowerCase().includes("company administrator") || roleName.toLowerCase().includes("company admin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to parent forms

    const isEditing = !!editingUser;

    if (!formData.firstName || !formData.lastName || !formData.role) {
      toast.error("Please fill in all required fields (Name and Role)");
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
      toast.error("Password must be at least 5 characters");
      return;
    }

    setLoading(true);
    try {
      let submissionRole = formData.role;
      let submissionCustomRoleId = "";

      if (formData.role.startsWith("CUSTOM:")) {
        submissionRole = "OPERATOR"; 
        submissionCustomRoleId = formData.role.split(":")[1];
      }

      const forceDeptId = forceSingleDepartmentId?.trim();
      const fallbackDeptIds = formData.departmentIds?.length
        ? formData.departmentIds
        : (formData.departmentId ? [formData.departmentId] : []);

      const finalDeptIds = forceDeptId
        ? [forceDeptId]
        : isMultiDept 
        ? formData.departmentIds 
        : (selectedSubDeptId 
            ? [selectedSubDeptId] 
            : (selectedMainDeptId && selectedMainDeptId !== "NONE" ? [selectedMainDeptId] : fallbackDeptIds));

      const submissionData: any = {
        ...formData,
        role: submissionRole || undefined,
        customRoleId: submissionCustomRoleId || null,
        companyId: formData.companyId || undefined,
        departmentIds: finalDeptIds,
        departmentId: forceDeptId
          ? forceDeptId
          : isMultiDept 
          ? (formData.departmentIds.length > 0 ? formData.departmentIds[0] : undefined)
          : (selectedSubDeptId || (selectedMainDeptId === "NONE" ? undefined : selectedMainDeptId) || formData.departmentId || undefined),
      };

      let response;
      if (isEditing) {
        if (!submissionData.password) delete (submissionData as any).password;
        response = await userAPI.update(editingUser!._id, submissionData);
      } else {
        response = await userAPI.create(submissionData);
      }

      if (response.success) {
        toast.success(isEditing ? "User updated successfully!" : "User created successfully!");
        window.dispatchEvent(new CustomEvent('REFRESH_PORTAL_DATA', { 
          detail: { scope: ['USERS', 'DEPARTMENTS', 'DASHBOARD'] } 
        }));
        onClose();
        if (response.data?.user) {
          onUserCreated(response.data.user);
        }
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

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || !isMounted) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 bg-gray-500/10 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-900">
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden focus-within:ring-0">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/30 rounded-xl flex items-center justify-center border border-indigo-500/50 shadow-inner backdrop-blur-sm">
                <Users className="w-5 h-5 text-indigo-50" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                  {editingUser ? "Modify Personnel Profile" : "Initialize New Personnel"}
                </CardTitle>
                <p className="text-[14px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Global Authorization Registry
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
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
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="user@example.com (Optional)" />
              </div>
              <div>
                <Label htmlFor="password">Password {editingUser ? "(Leave blank to keep current)" : "*"}</Label>
                <Input id="password" name="password" type="password" minLength={5} value={formData.password} onChange={handleChange} required={!editingUser} placeholder=" " />
              </div>
            </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData(prev => ({ ...prev, phone: val }));
                }} maxLength={10} placeholder="10 digit number" />
              </div>

            <div className="space-y-2">
              <Label className="text-[14px] font-black uppercase text-indigo-500">Personnel Designations</Label>
              <div className="flex gap-2">
                <Input 
                  id="new-designation" 
                  placeholder="Add another title..." 
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
                  onClick={() => {
                    const input = document.getElementById('new-designation') as HTMLInputElement;
                    if (input) {
                      const val = input.value.trim();
                      if (val && !formData.designations.includes(val)) {
                        setFormData(prev => ({ ...prev, designations: [...prev.designations, val] }));
                        input.value = '';
                      }
                    }
                  }}
                >Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.designations.map((d, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[14px] font-black rounded-lg uppercase tracking-tight">
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

            <div>
              <Label htmlFor="role">Role *</Label>
              <SearchableSelect
                options={getAllPossibleRoles()}
                value={formData.role}
                onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                placeholder="Select a role"
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">Assignment & Notifications</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            {isSuperAdmin(user) && !defaultCompanyId && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="companyId">Company *</Label>
                    <SearchableSelect
                        options={companies.map(c => ({ value: c._id, label: c.name }))}
                        value={formData.companyId}
                        onValueChange={(value) => {
                            setFormData((prev) => ({ ...prev, companyId: value, departmentId: "" }));
                            setSelectedMainDeptId("");
                            setSelectedSubDeptId("");
                        }}
                        placeholder="Select a company"
                        className="w-full"
                    />
                </div>
            )}

            {!hideDepartmentSelection && isCompanyAdminOrHigher(user) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-indigo-500" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-black uppercase tracking-tight text-slate-700">Assign Multiple Departments</span>
                      <span className="text-[14px] font-medium text-slate-400">Map this user to multiple organizational units</span>
                    </div>
                  </div>
                  <Switch 
                    checked={isMultiDept} 
                    onCheckedChange={setIsMultiDept} 
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>

                {!isMultiDept && isCompanyAdminOrHigher(user) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                          <Label>Main Department</Label>
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
                              placeholder={formData.companyId ? "No Department" : "Select Company First"}
                              disabled={!formData.companyId}
                              className="w-full"
                          />
                      </div>
                      {selectedMainDeptId && (
                          <div>
                              <Label>Sub Department</Label>
                              <SearchableSelect
                                  options={departments.filter(d => {
                                      const pid = typeof d.parentDepartmentId === "object" ? (d.parentDepartmentId as any)?._id : d.parentDepartmentId;
                                      return pid === selectedMainDeptId;
                                  }).map(d => ({ value: d._id, label: d.name }))}
                                  value={selectedSubDeptId}
                                  onValueChange={(value) => setSelectedSubDeptId(value)}
                                  placeholder="None (Map to Main)"
                                  className="w-full"
                              />
                          </div>
                      )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                          <Label className="text-[14px] font-black uppercase text-indigo-500 mb-1.5 flex items-center gap-1.5 leading-none">
                            <Building className="w-3 h-3" />
                            Department Branch
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
                          <Label className="text-[14px] font-black uppercase text-indigo-500 mb-1.5 flex items-center gap-1.5 leading-none">
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
                      <Label className="text-[14px] font-black uppercase tracking-widest text-slate-500">
                        Organizational Multi-Mapping ({formData.departmentIds.length})
                      </Label>
                      {formData.departmentIds.length > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setFormData(p => ({ ...p, departmentIds: [] }))}
                          className="text-[15px] font-black uppercase text-red-500 hover:text-red-700 transition-colors"
                        >
                          [ Clear All Assignments ]
                        </button>
                      )}
                    </div>

                    <div className="border rounded-xl px-2 py-2 bg-slate-50 max-h-[160px] overflow-y-auto custom-scrollbar space-y-1">
                      {departments.length === 0 && <p className="text-[14px] text-slate-400 text-center py-4">No departments found for this company</p>}
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
                                <span className={`text-[15px] font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                                  {dept.name}
                                </span>
                                {isSub && (
                                  <span className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">
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
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span className="text-[14px] font-black uppercase tracking-tight text-slate-700">Email</span>
                </div>
                <Switch checked={formData.notificationSettings.email} onCheckedChange={(checked) => setFormData(p => ({ ...p, notificationSettings: {...p.notificationSettings, email: checked, hasOverride: true} }))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span className="text-[14px] font-black uppercase tracking-tight text-slate-700">WhatsApp</span>
                </div>
                <Switch checked={formData.notificationSettings.whatsapp} onCheckedChange={(checked) => setFormData(p => ({ ...p, notificationSettings: {...p.notificationSettings, whatsapp: checked, hasOverride: true} }))} />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-900/40 border-0 rounded-xl font-black uppercase text-[14px] tracking-widest transition-all ring-1 ring-blue-500/50 active:scale-95">
                {loading ? "Processing..." : (editingUser ? "Update User" : "Create User")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>,
    modalRoot
  );
}
