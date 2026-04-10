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
import { departmentAPI, Department } from "@/lib/api/department";
import { companyAPI, Company } from "@/lib/api/company";
import { userAPI, User as APIUser } from "@/lib/api/user";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/lib/permissions";
import { Building, Shield, Languages, X, User, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import CreateUserDialog from "@/components/user/CreateUserDialog";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "or", label: "Odia" },
  { code: "mr", label: "Marathi" },
] as const;

const FALLBACK_LANGUAGES = LANGUAGE_OPTIONS.map((option) => option.code);

interface CreateDepartmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDepartmentCreated: () => void;
  editingDepartment?: Department | null;
  defaultCompanyId?: string;
  onEditUser?: (user: any) => void;
  showPriorityField?: boolean;
}

const CreateDepartmentDialog: React.FC<CreateDepartmentDialogProps> = ({
  isOpen,
  onClose,
  onDepartmentCreated,
  editingDepartment,
  defaultCompanyId,
  onEditUser,
  showPriorityField = true,
}) => {
  const { user } = useAuth();
  const isCompanyAdminUser =
    !isSuperAdmin(user) &&
    (user?.level === 1 ||
      (user?.role || "").toString().toLowerCase().includes("company"));
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [companyLanguages, setCompanyLanguages] = useState<string[]>(FALLBACK_LANGUAGES);
  const [activeLanguageTab, setActiveLanguageTab] = useState("en");
  const [isSubDepartment, setIsSubDepartment] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    nameHi: "",
    nameOr: "",
    nameMr: "",
    description: "",
    descriptionHi: "",
    descriptionOr: "",
    descriptionMr: "",
    companyId: "",
    parentDepartmentId: "",
    contactUserId: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    displayOrder: "999",
  });
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      if (editingDepartment) {
        const hasParent = !!editingDepartment.parentDepartmentId;
        setIsSubDepartment(hasParent);
        setFormData({
          name: editingDepartment.name || "",
          nameHi: editingDepartment.nameHi || "",
          nameOr: editingDepartment.nameOr || "",
          nameMr: editingDepartment.nameMr || "",
          description: editingDepartment.description || "",
          descriptionHi: editingDepartment.descriptionHi || "",
          descriptionOr: editingDepartment.descriptionOr || "",
          descriptionMr: editingDepartment.descriptionMr || "",
          companyId:
            editingDepartment.companyId &&
            typeof editingDepartment.companyId === "object"
              ? (editingDepartment.companyId as any)._id
              : (editingDepartment.companyId as string) || "",
          parentDepartmentId:
            editingDepartment.parentDepartmentId &&
            typeof editingDepartment.parentDepartmentId === "object"
              ? (editingDepartment.parentDepartmentId as any)._id
              : (editingDepartment.parentDepartmentId as string) || "",
          contactUserId: 
            editingDepartment.contactUserId && 
            typeof editingDepartment.contactUserId === "object"
              ? (editingDepartment.contactUserId as any)._id
              : (editingDepartment.contactUserId as string) || "",
          contactPerson: editingDepartment.contactPerson || "",
          contactEmail: editingDepartment.contactEmail || "",
          contactPhone: editingDepartment.contactPhone || "",
          displayOrder: String(editingDepartment.displayOrder ?? 999),
        });
      } else {
        const userCompanyId = user?.companyId
          ? typeof user.companyId === "object"
            ? user.companyId._id
            : user.companyId
          : "";

        const isDeptAdmin = user?.level === 2;
        const userDeptId = user?.departmentId
          ? typeof user.departmentId === "object"
            ? user.departmentId._id
            : user.departmentId
          : "";

        setIsSubDepartment(isDeptAdmin ? true : false);
        setFormData({
          name: "",
          nameHi: "",
          nameOr: "",
          nameMr: "",
          description: "",
          descriptionHi: "",
          descriptionOr: "",
          descriptionMr: "",
          companyId: defaultCompanyId || userCompanyId || "",
          parentDepartmentId: isDeptAdmin ? userDeptId : "",
          contactUserId: "",
          contactPerson: "",
          contactEmail: "",
          contactPhone: "",
          displayOrder: "999",
        });
      }
    }
  }, [isOpen, editingDepartment, user, defaultCompanyId]);

  const fetchDepartments = useCallback(async () => {
    if (!formData.companyId) return;
    try {
      const response = await departmentAPI.getAll({
        companyId: formData.companyId,
        listAll: true,
        limit: 1000,
      });
      if (response.success) {
        setAllDepartments(response.data.departments);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  }, [formData.companyId]);

  const fetchCompanyUsers = useCallback(async () => {
    if (!formData.companyId) {
      setCompanyUsers([]);
      return;
    }
    try {
      const response = await userAPI.getAll({
        companyId: formData.companyId,
        limit: 1000,
        status: 'active'
      });
      if (response.success) {
        setCompanyUsers(response.data.users);
      }
    } catch (error) {
      console.error("Failed to fetch company users:", error);
    }
  }, [formData.companyId]);

  const fetchCompanies = async () => {
    try {
      const response = await companyAPI.getAll();
      if (response.success) {
        setCompanies(response.data.companies);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    }
  };

  const resolveSelectedLanguages = (company?: Company | null) => {
    const selected = company?.selectedLanguages?.length
      ? company.selectedLanguages
      : FALLBACK_LANGUAGES;

    return Array.from(new Set(["en", ...selected])).filter((language) =>
      FALLBACK_LANGUAGES.includes(language as any),
    );
  };

  const syncLanguagesForCompany = useCallback(
    async (companyId?: string) => {
      try {
        if (isSuperAdmin(user)) {
          if (!companyId) {
            setCompanyLanguages(FALLBACK_LANGUAGES);
            return;
          }

          const selectedCompany = companies.find((company) => company._id === companyId);
          if (selectedCompany) {
            setCompanyLanguages(resolveSelectedLanguages(selectedCompany));
            return;
          }

          const response = await companyAPI.getById(companyId);
          if (response.success) {
            setCompanyLanguages(resolveSelectedLanguages(response.data.company));
          }
          return;
        }

        const response = await companyAPI.getMyCompany();
        if (response.success) {
          setCompanyLanguages(resolveSelectedLanguages(response.data.company));
        }
      } catch (error) {
        console.error("Failed to fetch company languages:", error);
        setCompanyLanguages(FALLBACK_LANGUAGES);
      }
    },
    [companies, user],
  );

  useEffect(() => {
    if (isOpen && formData.companyId) {
      fetchDepartments();
      fetchCompanyUsers();
    }
  }, [isOpen, formData.companyId, fetchDepartments, fetchCompanyUsers]);

  useEffect(() => {
    if (!isOpen) return;
    syncLanguagesForCompany(formData.companyId);
  }, [isOpen, formData.companyId, syncLanguagesForCompany]);

  useEffect(() => {
    if (!companyLanguages.includes(activeLanguageTab)) {
      setActiveLanguageTab(companyLanguages[0] || "en");
    }
  }, [companyLanguages, activeLanguageTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error("Please enter department name");
      return;
    }
    if (!formData.companyId) {
      toast.error("Please select a company");
      return;
    }
    if (isSubDepartment && !formData.parentDepartmentId) {
      toast.error("Please select a main department");
      return;
    }

    setLoading(true);
    try {
      let response;
      const dataToSubmit: any = {
        ...formData,
        parentDepartmentId: isSubDepartment 
          ? (formData.parentDepartmentId || undefined) 
          : null,
        contactUserId: formData.contactUserId || undefined,
      };

      if (!isSubDepartment) {
        dataToSubmit.displayOrder = Number(formData.displayOrder || "999");
        if (!Number.isFinite(dataToSubmit.displayOrder) || dataToSubmit.displayOrder < 0) {
          toast.error("Priority must be a non-negative number");
          setLoading(false);
          return;
        }

        dataToSubmit.displayOrder = Math.floor(dataToSubmit.displayOrder);
      }
      // Ensure we don't send empty strings for optional fields that should be omitted
      Object.keys(dataToSubmit).forEach(key => {
        if (dataToSubmit[key] === "") {
          delete dataToSubmit[key];
        }
      });

      if (editingDepartment) {
        response = await departmentAPI.update(
          editingDepartment._id,
          dataToSubmit,
        );
        if (response.success) {
          toast.success("Department updated successfully!");
        } else {
          toast.error("Failed to update department");
        }
      } else {
        response = await departmentAPI.create(dataToSubmit);
        if (response.success) {
          toast.success("Department created successfully!");
        } else {
          toast.error("Failed to create department");
        }
      }

      if (response.success) {
        // Dispatch global refresh event for synchronization
        window.dispatchEvent(new CustomEvent('REFRESH_PORTAL_DATA', {
          detail: { scope: ['DEPARTMENTS', 'USERS', 'DASHBOARD'] }
        }));
        
        setFormData({
          name: "",
          nameHi: "",
          nameOr: "",
          nameMr: "",
          description: "",
          descriptionHi: "",
          descriptionOr: "",
          descriptionMr: "",
          companyId: "",
          parentDepartmentId: "",
          contactUserId: "",
          contactPerson: "",
          contactEmail: "",
          contactPhone: "",
          displayOrder: "999",
        });
        onClose();
        onDepartmentCreated();
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        (editingDepartment
          ? "Failed to update department"
          : "Failed to create department");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center border border-white/25 shadow-lg group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                {editingDepartment
                  ? "Modify Department Node"
                  : "Initialize New Department"}
              </CardTitle>
              <p className="text-[10px] text-gray-100/70 font-bold uppercase tracking-widest mt-0.5">
                Global Infrastructure Registry
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
            <X className="w-5 h-5 text-white group-hover:text-white transition-colors" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company selector - only shown to SuperAdmin if not default */}
            {isSuperAdmin(user) && !defaultCompanyId ? (
              <div>
                <Label htmlFor="companyId" className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Company *</Label>
                <SearchableSelect
                  options={companies.map((company) => ({
                    value: company._id,
                    label: company.name,
                  }))}
                  value={formData.companyId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      companyId: value,
                      parentDepartmentId: "",
                    }))
                  }
                  placeholder="Select a company"
                  className="w-full"
                />
              </div>
            ) : (
              /* Hidden company ID for Company Admin or other roles with fixed company */
              <input type="hidden" name="companyId" value={formData.companyId} />
            )}

            {/* Department Hierarchy Toggle - Restricted for Dept Admins */}
            {(user?.level || 4) <= 1 ? (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 mb-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 block text-center">Department Structure</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubDepartment(false);
                      setFormData(prev => ({ ...prev, parentDepartmentId: "" }));
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                      !isSubDepartment
                        ? "bg-slate-800 text-white border-slate-700 shadow-md shadow-slate-900/40 ring-1 ring-blue-500/50"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-800 hover:text-slate-800"
                    }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    Main Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSubDepartment(true)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                      isSubDepartment
                        ? "bg-slate-800 text-white border-slate-700 shadow-md shadow-slate-900/40 ring-1 ring-blue-500/50"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-800 hover:text-slate-800"
                    }`}
                  >
                    <div className="flex items-center">
                      <Building className="w-3.5 h-3.5" />
                      <Building className="w-2.5 h-2.5 -ml-1 mt-1 opacity-70" />
                    </div>
                    Sub Department
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-4">
                <div className="flex items-baseline justify-between px-2">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Target Unit Level</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Department</span>
                </div>
              </div>
            )}

            {/* Parent Department Selection for Sub Department */}
            {isSubDepartment && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="parentDepartmentId" className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Select Main Department *
                </Label>
                {(user?.level || 4) <= 1 ? (
                  <SearchableSelect
                    options={allDepartments
                      .filter((d) => {
                        const parentId = typeof d.parentDepartmentId === 'object' && d.parentDepartmentId !== null
                          ? (d.parentDepartmentId as any)._id
                          : d.parentDepartmentId;
                        return !parentId;
                      })
                      .filter((d) => !editingDepartment || d._id !== editingDepartment._id)
                      .map((dept) => ({
                        value: dept._id,
                        label: dept.name,
                      }))}
                    value={formData.parentDepartmentId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        parentDepartmentId: value,
                      }))
                    }
                    placeholder="-- Choose Parent Department --"
                    className="w-full"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                    <Building className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">
                      {allDepartments.find(d => (d._id === formData.parentDepartmentId))?.name || "Your Assigned Department"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {isCompanyAdminUser && showPriorityField && !isSubDepartment && (
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                <Label
                  htmlFor="displayOrder"
                  className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1.5 block"
                >
                  Department Priority (Lower = Higher)
                </Label>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min={0}
                  step={1}
                  value={formData.displayOrder}
                  onChange={handleChange}
                  placeholder="e.g. 1"
                  className="border-amber-200 focus:border-amber-500 bg-white"
                />
                <p className="mt-1.5 text-[10px] text-amber-800 font-semibold">
                  Example: 1 appears before 2. Default is 999 for normal order.
                </p>
              </div>
            )}

            

            <div className="pt-2 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Languages className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  Localized Identity
                </span>
              </div>

              <Tabs value={activeLanguageTab} onValueChange={setActiveLanguageTab} className="w-full">
                <TabsList
                  className="grid w-full h-10 bg-slate-100 p-1 rounded-xl"
                  style={{ gridTemplateColumns: `repeat(${Math.max(companyLanguages.length, 1)}, minmax(0, 1fr))` }}
                >
                  {LANGUAGE_OPTIONS.filter((option) => companyLanguages.includes(option.code)).map((option) => (
                    <TabsTrigger
                      key={option.code}
                      value={option.code}
                      className="rounded-lg text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* English Content */}
                {companyLanguages.includes("en") && <TabsContent
                  value="en"
                  className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      {isSubDepartment ? "Sub-Department Name (Required)" : "Main Department Name (Required)"}
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder={isSubDepartment ? "e.g. Land Records Division" : "e.g. Revenue Department"}
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  {/* <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      Infrastructure Role / Description
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Define the functional scope of this department..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div> */}
                </TabsContent>}

                {/* Hindi Content */}
                {companyLanguages.includes("hi") && <TabsContent
                  value="hi"
                  className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="nameHi"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      {isSubDepartment ? "हिंदी उप-विभाग नाम (Required)" : "हिंदी मुख्य विभाग नाम (Required)"}
                    </Label>
                    <Input
                      id="nameHi"
                      name="nameHi"
                      type="text"
                      value={formData.nameHi}
                      onChange={handleChange}
                      placeholder="हिंदी नाम यहाँ लिखें..."
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  {/* <div className="space-y-2">
                    <Label
                      htmlFor="descriptionHi"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      हिंदी विवरण (Hindi Description)
                    </Label>
                    <Textarea
                      id="descriptionHi"
                      name="descriptionHi"
                      value={formData.descriptionHi}
                      onChange={handleChange}
                      rows={3}
                      placeholder="विवरण यहाँ लिखें..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div> */}
                </TabsContent>}

                {/* Odia Content */}
                {companyLanguages.includes("or") && <TabsContent
                  value="or"
                  className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="nameOr"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      {isSubDepartment ? "ଓଡ଼ିଆ ଉପ-ବିଭାଗ ନାମ (Required)" : "ଓଡ଼ିଆ ମୁଖ୍ୟ ବିଭାଗ ନାମ (Required)"}
                    </Label>
                    <Input
                      id="nameOr"
                      name="nameOr"
                      type="text"
                      value={formData.nameOr}
                      onChange={handleChange}
                      placeholder="ଓଡ଼ିଆ ନାମ ଏଠାରେ ଲେଖନ୍ତୁ..."
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  {/* <div className="space-y-2">
                    <Label
                      htmlFor="descriptionOr"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      ଓଡ଼ିଆ ବିବରଣୀ (Odia Description)
                    </Label>
                    <Textarea
                      id="descriptionOr"
                      name="descriptionOr"
                      value={formData.descriptionOr}
                      onChange={handleChange}
                      rows={3}
                      placeholder="ବିବରଣୀ ଏଠାରେ ଲେଖନ୍ତୁ..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div> */}
                </TabsContent>}

                {/* Marathi Content */}
                {companyLanguages.includes("mr") && <TabsContent
                  value="mr"
                  className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="nameMr"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      {isSubDepartment ? "मराठी उप-विभाग नाव (Required)" : "मराठी मुख्य विभाग नाव (Required)"}
                    </Label>
                    <Input
                      id="nameMr"
                      name="nameMr"
                      type="text"
                      value={formData.nameMr}
                      onChange={handleChange}
                      placeholder="मराठी नाव येथे लिहा..."
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  {/* <div className="space-y-2">
                    <Label
                      htmlFor="descriptionMr"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                    >
                      मराठी विवरण (Marathi Description)
                    </Label>
                    <Textarea
                      id="descriptionMr"
                      name="descriptionMr"
                      value={formData.descriptionMr}
                      onChange={handleChange}
                      rows={3}
                      placeholder="वर्णन येथे लिहा..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div> */}
                </TabsContent>}
              </Tabs>
            </div>
 {/* Department Lead / Contact Selection */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Department Lead / Contact Personnel
                </Label>
                {formData.contactUserId && onEditUser && (
                  <button
                    type="button"
                    onClick={() => {
                      const selected = companyUsers.find(u => u._id === formData.contactUserId);
                      if (selected) onEditUser(selected);
                    }}
                    className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-600 hover:text-white hover:bg-indigo-600 bg-white px-2 py-1 rounded-md border border-indigo-200 shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <User className="w-2.5 h-2.5" />
                    Edit User Profile
                  </button>
                )}
              </div>
              <SearchableSelect
                options={companyUsers
                  .sort((a, b) => a.firstName.localeCompare(b.firstName))
                  .map((u) => {
                    const roleName = (u.customRoleId && typeof u.customRoleId === 'object') 
                      ? u.customRoleId.name 
                      : (u.role || 'No Role');
                    return {
                      value: u._id,
                      label: `${u.firstName} ${u.lastName} (${roleName})`,
                    };
                  })}
                value={formData.contactUserId}
                onValueChange={(value) => {
                  const selectedUser = companyUsers.find((u) => u._id === value);
                  setFormData((prev) => ({
                    ...prev,
                    contactUserId: value,
                    contactPerson: selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "",
                    contactEmail: selectedUser?.email || "",
                    contactPhone: selectedUser?.phone || "",
                  }));
                }}
                actionInHeader={true}
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCreateUser(true);
                    }}
                    className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex-shrink-0"
                    title="Add New User Account"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                }
                placeholder="-- Select Lead --"
                className="w-full bg-white"
              />
              <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                {formData.contactUserId 
                  ? "This user will be designated as the primary point of contact for this unit."
                  : "Associate an existing user account to receive administrative notifications."}
              </p>
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
                className="px-6 bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-900/40 border-0 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ring-1 ring-blue-500/50 active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {editingDepartment ? "Updating..." : "Creating..."}
                  </span>
                ) : editingDepartment ? (
                  "Update"
                ) : formData.parentDepartmentId ? (
                  "Create Sub-Department"
                ) : (
                  "Create Department"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Nested Create User Dialog - Rendered outside the main form to prevent nesting errors */}
      {showCreateUser && (
        <CreateUserDialog
          isOpen={showCreateUser}
          onClose={() => setShowCreateUser(false)}
          defaultCompanyId={formData.companyId}
          hideDepartmentSelection={true}
          onUserCreated={async (newUser) => {
            const newId = newUser?._id || (newUser as any)?.id;
            if (newUser && newId) {
              // Create a display-ready version of the new user to ensure the label renders correctly
              const roleName = (newUser.customRoleId && typeof newUser.customRoleId === 'object') 
                ? (newUser.customRoleId as any).name 
                : (newUser.role || 'Personnel');

              const formattedUser = {
                ...newUser,
                displayName: `${newUser.firstName} ${newUser.lastName} (${roleName})`
              };

              // Update the list immediately
              setCompanyUsers(prev => {
                const exists = prev.some(u => (u._id || (u as any).id) === newId);
                if (!exists) return [formattedUser, ...prev];
                return prev.map(u => (u._id || (u as any).id) === newId ? formattedUser : u);
              });
              
              // Set the lead info immediately
              setFormData((prev) => ({
                ...prev,
                contactUserId: newId,
                contactPerson: `${newUser.firstName} ${newUser.lastName}`,
                contactEmail: newUser.email || "",
                contactPhone: newUser.phone || "",
              }));
              
              toast.success(`Personnel "${newUser.firstName}" mapped as Department Lead`);
              
              // Background sync to ensure full data consistency from server
              fetchCompanyUsers();
            }
            
            // Finally close the dialog
            setShowCreateUser(false);
          }}
        />
      )}
    </div>
  );
};

export default CreateDepartmentDialog;
