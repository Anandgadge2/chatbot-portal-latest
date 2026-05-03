import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Shield,
  Save,
  RefreshCw,
  Search,
  CheckCircle2,
  Users as UsersIcon,
  User as UserIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api/client";
import { userAPI, User } from "@/lib/api/user";
import { roleAPI } from "@/lib/api/role";
import { formatRoleLabel } from "@/lib/utils/roleLabel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Role {
  _id: string;
  name: string;
  key?: string;
  isSystem: boolean;
}

interface Department {
  _id: string;
  name: string;
  parentDepartmentId?: string | { _id: string; name: string };
}

interface NotificationManagementProps {
  companyId: string;
}

const NotificationManagement: React.FC<NotificationManagementProps> = ({
  companyId,
}) => {
  const [activeSubTab, setActiveSubTab] = useState("roles");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<any>({});
  const [userSettings, setUserSettings] = useState<{ [userId: string]: { email: boolean, whatsapp: boolean, hasOverride?: boolean, actions?: any } }>({});
  const [modifiedUsers, setModifiedUsers] = useState<Set<string>>(new Set());

  // Filters
  const [mainDepartments, setMainDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [mainDeptFilter, setMainDeptFilter] = useState("");
  const [subDeptFilter, setSubDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRes, rolesRes, usersRes] = await Promise.all([
        apiClient.get(`/companies/${companyId}`),
        roleAPI.getRoles(companyId, true),
        userAPI.getAll({ companyId, limit: 1000 }),
      ]);

      if (companyRes.success) {
        setCompany(companyRes.data.company);
        const settings = companyRes.data.company.notificationSettings?.roles || {};
        setNotificationSettings(settings);
      }

      if (rolesRes.success) {
        setRoles(rolesRes.data.roles || []);
      }

      if (usersRes.success) {
        setUsers(usersRes.data.users || []);
        const uSettings: any = {};
        usersRes.data.users.forEach((u: User) => {
          uSettings[u._id] = u.notificationSettings || { email: true, whatsapp: true };
        });
        setUserSettings(uSettings);
      }

      // Fetch Departments
      const deptRes = await apiClient.get(`/departments?companyId=${companyId}&listAll=true`);
      if (deptRes.success) {
        const depts = deptRes.data.departments || [];
        setAllDepartments(depts);
        setMainDepartments(depts.filter((d: any) => !d.parentDepartmentId));
      }
    } catch (err: any) {
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const NOTIFICATION_ACTIONS = [
    { key: "grievance_created", label: "Grievance Created", category: "grievance" },
    { key: "grievance_status_update", label: "Grievance Status Update", category: "grievance" },
    { key: "grievance_assigned", label: "Grievance Assigned", category: "grievance" },
    { key: "grievance_reminder", label: "Grievance Reminder", category: "grievance" },
    { key: "grievance_reverted", label: "Grievance Reverted", category: "grievance", adminOnly: true },
    { key: "appointment_created", label: "Appointment Received", category: "appointment" },
    { key: "appointment_scheduled", label: "Appointment Confirmed", category: "appointment" },
    { key: "appointment_resolved", label: "Appointment Completed", category: "appointment" },
  ];

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRoleSetting = (
    roleKey: string,
    type: "email" | "whatsapp",
    value: boolean,
  ) => {
    setNotificationSettings((prev: any) => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || { email: true, whatsapp: true, actions: {} }),
        [type]: value,
      },
    }));
  };

  const toggleRoleActionSetting = (
    roleKey: string,
    actionKey: string,
    type: "email" | "whatsapp",
    value: boolean
  ) => {
    setNotificationSettings((prev: any) => {
      const roleSet = prev[roleKey] || { email: true, whatsapp: true, actions: {} };
      const actions = roleSet.actions || {};
      return {
        ...prev,
        [roleKey]: {
          ...roleSet,
          actions: {
            ...actions,
            [actionKey]: {
              ...(actions[actionKey] || { email: true, whatsapp: true }),
              [type]: value,
            },
          },
        },
      };
    });
  };

  const toggleUserSetting = (
    userId: string,
    type: "email" | "whatsapp",
    value: boolean,
  ) => {
    setUserSettings((prev: any) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || { email: true, whatsapp: true, actions: {} }),
        [type]: value,
        hasOverride: true, // 🚩 Set flag on manual modification
      },
    }));
    setModifiedUsers(prev => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  };

  const toggleUserActionSetting = (
    userId: string,
    actionKey: string,
    type: "email" | "whatsapp",
    value: boolean
  ) => {
    setUserSettings((prev: any) => {
      const userSet = prev[userId] || { email: true, whatsapp: true, actions: {} };
      const actions = userSet.actions || {};
      return {
        ...prev,
        [userId]: {
          ...userSet,
          hasOverride: true, // 🚩 Set flag on manual modification
          actions: {
            ...actions,
            [actionKey]: {
              ...(actions[actionKey] || { email: true, whatsapp: true }),
              [type]: value,
            },
          },
        },
      };
    });
    setModifiedUsers(prev => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saves = [];
      
      // Save Role Settings to Company
      saves.push(apiClient.put(`/companies/${companyId}`, {
        notificationSettings: {
          roles: notificationSettings,
        },
      }));

      // Save Modified User Settings
      if (modifiedUsers.size > 0) {
        modifiedUsers.forEach(userId => {
          saves.push(userAPI.update(userId, {
            notificationSettings: userSettings[userId]
          }));
        });
      }

      const results = await Promise.all(saves);
      const allSuccess = results.every(res => res.success);

      if (allSuccess) {
        toast.success("All notification protocols updated successfully");
        setModifiedUsers(new Set());
      } else {
        toast.error("Some settings failed to save. Please review.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.key?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredUsers = users.filter(
    (u) => {
      const matchesSearch = u.firstName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        u.lastName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm);

      const userDeptId = typeof u.departmentId === 'object' ? (u.departmentId as any)?._id : u.departmentId;
      
      // Main Dept Filter
      let matchesMainDept = true;
      if (mainDeptFilter) {
        const selectedMainDept = allDepartments.find(d => d._id === mainDeptFilter);
        const childDepts = allDepartments.filter(d => {
          const parentId = typeof d.parentDepartmentId === 'object' ? d.parentDepartmentId?._id : d.parentDepartmentId;
          return parentId === mainDeptFilter;
        });
        const validDeptIds = [mainDeptFilter, ...childDepts.map(d => d._id)];
        matchesMainDept = validDeptIds.includes(userDeptId);
      }

      // Sub Dept Filter
      let matchesSubDept = true;
      if (subDeptFilter) {
        matchesSubDept = userDeptId === subDeptFilter;
      }

      // Role Filter
      let matchesRole = true;
      if (roleFilter) {
        matchesRole = u.role === roleFilter;
      }

      return matchesSearch && matchesMainDept && matchesSubDept && matchesRole;
    }
  );

  useEffect(() => {
    if (mainDeptFilter) {
      setSubDepartments(allDepartments.filter(d => {
        const parentId = typeof d.parentDepartmentId === 'object' ? d.parentDepartmentId?._id : d.parentDepartmentId;
        return parentId === mainDeptFilter;
      }));
      setSubDeptFilter(""); // Reset sub dept when main dept changes
    } else {
      setSubDepartments([]);
      setSubDeptFilter("");
    }
  }, [mainDeptFilter, allDepartments]);

  if (loading && !company) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 font-black uppercase tracking-widest text-[14px]">
          Syncing Notification Matrix...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
           <TabsList className="bg-white/50 backdrop-blur-sm p-1 h-auto lg:h-14 rounded-xl lg:rounded-2xl gap-1.5 border border-slate-200 flex w-full lg:w-auto">
            <TabsTrigger 
              value="roles" 
              className="px-2 sm:px-4 lg:px-8 h-9 lg:h-11 rounded-lg lg:rounded-xl text-[11px] sm:text-[14px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 transition-all flex-1 lg:flex-none"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 lg:mr-2" />
              <span className="truncate">Authority Roles</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="px-2 sm:px-4 lg:px-8 h-9 lg:h-11 rounded-lg lg:rounded-xl text-[11px] sm:text-[14px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 transition-all flex-1 lg:flex-none"
            >
              <UsersIcon className="w-3.5 h-3.5 mr-1.5 lg:mr-2" />
              <span className="truncate">Personnel Entities</span>
            </TabsTrigger>
          </TabsList>
          
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={mainDeptFilter}
                onChange={(e) => setMainDeptFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 sm:px-3 h-9 sm:h-10 text-[10px] sm:text-[14px] font-black uppercase tracking-tight sm:tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm w-full sm:min-w-[180px]"
              >
                <option value="">All Main Depts</option>
                {mainDepartments.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              
              <select
                value={subDeptFilter}
                onChange={(e) => setSubDeptFilter(e.target.value)}
                disabled={!mainDeptFilter}
                className="bg-white border border-slate-200 rounded-lg px-2 sm:px-3 h-9 sm:h-10 text-[10px] sm:text-[14px] font-black uppercase tracking-tight sm:tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm w-full sm:min-w-[180px] disabled:opacity-50"
              >
                <option value="">All Sub Depts</option>
                {subDepartments.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 sm:px-3 h-9 sm:h-10 text-[10px] sm:text-[14px] font-black uppercase tracking-tight sm:tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm w-full sm:min-w-[150px]"
              >
                <option value="">All Roles</option>
                {Array.from(new Set(roles.map(r => formatRoleLabel(r.key || r.name))))
                  .filter(label => label !== 'Platform Superadmin' && label !== 'Super Admin')
                  .map(label => {
                    const firstRoleMatch = roles.find(r => formatRoleLabel(r.key || r.name) === label);
                    return (
                      <option key={label} value={firstRoleMatch?.key || firstRoleMatch?.name}>
                        {label}
                      </option>
                    );
                  })
                }
              </select>

              <div className="relative w-full sm:w-48 lg:w-56">
                <input
                  type="text"
                  placeholder={activeSubTab === "roles" ? "Search..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 h-9 sm:h-10 text-[10px] sm:text-[14px] font-black uppercase tracking-tight sm:tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="col-span-2 sm:col-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 h-9 sm:h-10 rounded-lg font-black uppercase tracking-widest text-[11px] sm:text-[14px] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all border-0 w-full sm:w-auto"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-2" />
                )}
                <span className="whitespace-nowrap">Update Protocols</span>
              </Button>
            </div>
        </div>

        <Card className="border-slate-200 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
          <TabsContent value="roles" className="m-0">
             <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 whitespace-nowrap">
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-left text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400">Designation</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-center text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400 w-16 lg:w-32">EM</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-center text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400 w-16 lg:w-32">WA</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-right text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400">Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {filteredRoles.map((role) => {
                    const roleKey = role.key || role.name;
                    const settings = notificationSettings[roleKey] || { email: true, whatsapp: true, actions: {} };
                    const isExpanded = expandedRows.has(roleKey);

                    return (
                      <React.Fragment key={roleKey}>
                        <tr className={`group transition-all ${isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50/50"}`}>
                          <td className="px-3 lg:px-8 py-3 lg:py-6">
                            <div className="flex items-center gap-2 lg:gap-4">
                              <div className={`w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-2xl flex items-center justify-center border shadow-sm shrink-0 ${role.isSystem ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-200"}`}>
                                <Shield className={`w-4 h-4 lg:w-6 lg:h-6 ${role.isSystem ? "text-indigo-500" : "text-slate-400"}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] lg:text-sm font-black text-slate-800 uppercase tracking-tight truncate">{role.name}</p>
                                <p className="text-[9px] lg:text-[15px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                  {role.isSystem ? "Sys" : "Cst"} • {roleKey.split('_').pop()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-4 lg:py-6">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.email}
                                onChange={(e: any) => toggleRoleSetting(roleKey, "email", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-4 lg:py-6">
                             <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.whatsapp}
                                onChange={(e: any) => toggleRoleSetting(roleKey, "whatsapp", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-3 lg:px-8 py-3 lg:py-6 text-right">
                             <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleRowExpansion(roleKey)}
                                className={`px-2 lg:px-4 h-7 lg:h-9 rounded-lg text-[10px] lg:text-[14px] font-black uppercase tracking-widest transition-all ${isExpanded ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
                             >
                               <span className="hidden sm:inline">{isExpanded ? "Hide Details" : "Action Control"}</span>
                               <span className="sm:hidden">{isExpanded ? "Close" : "Actions"}</span>
                               <Bell className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ml-1 lg:ml-2 ${isExpanded ? "animate-bounce" : ""}`} />
                             </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={4} className="px-4 lg:px-12 py-6 lg:py-8 border-t border-indigo-100/30">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[14px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Granular Template Override
                                  </h4>
                                  <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">
                                    Define specific triggers for this role. If unchecked, base protocol applies.
                                  </p>
                                </div>
                                  <div className="space-y-3">
                                  {NOTIFICATION_ACTIONS.filter(action => {
                                    // Filter by category (appointment)
                                    if (action.category === "appointment") {
                                      return company?.enabledModules?.includes("APPOINTMENT");
                                    }
                                    // Filter by adminOnly
                                    if (action.adminOnly) {
                                      const roleKeyLower = role.key?.toLowerCase();
                                      return roleKeyLower === "company-admin" || roleKeyLower === "company_admin";
                                    }
                                    return true;
                                  }).map(action => {
                                    const actionSet = settings.actions?.[action.key] || { email: true, whatsapp: true };
                                    return (
                                      <div key={action.key} className="bg-white p-3 lg:p-4 rounded-xl border border-indigo-100/50 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-3">
                                        <span className="text-[14px] font-black uppercase tracking-tight text-slate-600">
                                          {action.label}
                                        </span>
                                        <div className="flex items-center gap-4 lg:gap-6">
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.email}
                                              onChange={(e: any) => toggleRoleActionSetting(roleKey, action.key, "email", e.target.checked)}
                                            />
                                            <span className="text-[15px] font-bold text-slate-400">EMAIL</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.whatsapp}
                                              onChange={(e: any) => toggleRoleActionSetting(roleKey, action.key, "whatsapp", e.target.checked)}
                                            />
                                            <span className="text-[15px] font-bold text-slate-400">WA</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="users" className="m-0">
             <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 whitespace-nowrap">
                  <tr className="bg-slate-50/50 border-b border-slate-100 whitespace-nowrap">
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-left text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400">Personnel Entity</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-center text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400 w-16 lg:w-32">EM</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-center text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400 w-16 lg:w-32">WA</th>
                    <th className="px-3 lg:px-8 py-4 lg:py-6 text-right text-[11px] lg:text-[14px] font-black uppercase tracking-widest text-slate-400">Logic</th>
                  </tr>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {filteredUsers.map((u) => {
                    const settings: any = userSettings[u._id] || { email: true, whatsapp: true, actions: {} };
                    const isModified = modifiedUsers.has(u._id);
                    const isExpanded = expandedRows.has(u._id);

                    return (
                      <React.Fragment key={u._id}>
                        <tr className={`group transition-all ${isExpanded ? "bg-indigo-50/40" : "hover:bg-slate-50/60"} ${isModified ? 'border-l-4 border-l-indigo-600 shadow-[inset_4px_0_0_0_rgb(79,70,229)]' : ''}`}>
                          <td className="px-3 lg:px-8 py-3 lg:py-6">
                            <div className="flex items-center gap-2 lg:gap-4">
                              <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-2xl flex items-center justify-center border bg-white border-slate-200 shadow-sm relative shrink-0 overflow-hidden group-hover:border-indigo-200 transition-colors">
                                {u.firstName ? (
                                  <div className="w-full h-full bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center text-[10px] lg:text-xs font-black text-indigo-600">
                                    {(u.firstName[0] || '') + (u.lastName?.[0] || '')}
                                  </div>
                                ) : (
                                  <UserIcon className="w-4 h-4 lg:w-6 lg:h-6 text-slate-300" />
                                )}
                                {isModified && (
                                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full border border-white" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] lg:text-[15px] font-black text-slate-800 uppercase tracking-tight leading-tight truncate">
                                  {u.firstName} {u.lastName}
                                </p>
                                <div className="flex flex-wrap items-center gap-1 lg:gap-2 mt-0.5 sm:mt-1">
                                  <span className="text-[9px] lg:text-[15px] font-bold text-slate-400 uppercase tracking-tight sm:tracking-widest truncate max-w-[100px] sm:max-w-[150px]">
                                    {u.email || u.phone || 'N/A'}
                                  </span>
                                  {u.role && (
                                    <>
                                      <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0 hidden sm:block" />
                                      <span className="text-[9px] lg:text-[15px] font-black text-indigo-500 uppercase tracking-tight sm:tracking-widest shrink-0">
                                        {formatRoleLabel(u.role).split(' ').pop()}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-4 lg:py-6">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.email}
                                onChange={(e: any) => toggleUserSetting(u._id, "email", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-4 lg:py-6">
                             <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.whatsapp}
                                onChange={(e: any) => toggleUserSetting(u._id, "whatsapp", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-3 lg:px-8 py-3 lg:py-6 text-right">
                             <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleRowExpansion(u._id)}
                                className={`px-2 lg:px-4 h-7 lg:h-9 rounded-lg text-[10px] lg:text-[14px] font-black uppercase tracking-widest transition-all ${isExpanded ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
                             >
                               <span className="hidden sm:inline">{isExpanded ? "Hide Details" : "Action Control"}</span>
                               <span className="sm:hidden">{isExpanded ? "Close" : "Actions"}</span>
                               <Bell className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ml-1 lg:ml-2 ${isExpanded ? "animate-bounce" : ""}`} />
                             </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={4} className="px-4 lg:px-12 py-6 lg:py-8 border-t border-indigo-100/30">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[14px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center">
                                    <Mail className="w-4 h-4 mr-2" />
                                    Entity Specific Triggers
                                  </h4>
                                  <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">
                                    Personalize template notifications for this specific personnel entity.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {NOTIFICATION_ACTIONS.filter(action => {
                                    // Filter by category (appointment)
                                    if (action.category === "appointment") {
                                      return company?.enabledModules?.includes("APPOINTMENT");
                                    }
                                    // Filter by adminOnly
                                    if (action.adminOnly) {
                                      const userRoleLower = u.role?.toLowerCase();
                                      return userRoleLower === "company-admin" || userRoleLower === "company_admin";
                                    }
                                    return true;
                                  }).map(action => {
                                    const actionSet = settings.actions?.[action.key] || { email: true, whatsapp: true };
                                    return (
                                      <div key={action.key} className="bg-white p-3 lg:p-4 rounded-xl border border-indigo-100/50 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-3">
                                        <span className="text-[14px] font-black uppercase tracking-tight text-slate-600">
                                          {action.label}
                                        </span>
                                        <div className="flex items-center gap-4 lg:gap-6">
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.email}
                                              onChange={(e: any) => toggleUserActionSetting(u._id, action.key, "email", e.target.checked)}
                                            />
                                            <span className="text-[15px] font-bold text-slate-400">EMAIL</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.whatsapp}
                                              onChange={(e: any) => toggleUserActionSetting(u._id, action.key, "whatsapp", e.target.checked)}
                                            />
                                            <span className="text-[15px] font-bold text-slate-400">WA</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
};

export default NotificationManagement;
