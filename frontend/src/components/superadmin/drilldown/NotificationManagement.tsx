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
  const [userSettings, setUserSettings] = useState<{ [userId: string]: { email: boolean, whatsapp: boolean, actions?: any } }>({});
  const [modifiedUsers, setModifiedUsers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRes, rolesRes, usersRes] = await Promise.all([
        apiClient.get(`/companies/${companyId}`),
        apiClient.get(`/roles?companyId=${companyId}`),
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
    { key: "grievance_created", label: "Grievance Form Submitted (New Received)" },
    { key: "grievance_assigned", label: "Grievance Assigned / Reassigned" },
    { key: "grievance_resolved", label: "Grievance Resolution Updates" },
    { key: "appointment_created", label: "Appointment Booked / Received" },
    { key: "appointment_scheduled", label: "Appointment Scheduling / Confirmation" },
    { key: "appointment_resolved", label: "Appointment Resolution / Completion" },
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
    (u) =>
      u.firstName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      u.lastName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm)
  );

  if (loading && !company) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 font-black uppercase tracking-widest text-[10px]">
          Syncing Notification Matrix...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
        <div className="flex items-center justify-between">
           <TabsList className="bg-white/50 backdrop-blur-sm p-1.5 h-14 rounded-2xl gap-2 border border-slate-200">
            <TabsTrigger 
              value="roles" 
              className="px-8 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 transition-all"
            >
              <Shield className="w-4 h-4 mr-2" />
              Authority Roles
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="px-8 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 transition-all"
            >
              <UsersIcon className="w-4 h-4 mr-2" />
              Personnel Entities
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <input
                type="text"
                placeholder={activeSubTab === "roles" ? "Search roles..." : "Search entities..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-12 text-[11px] font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all border-0"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Update Protocols
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-2xl rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
          <TabsContent value="roles" className="m-0">
             <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Designation</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Email</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">WhatsApp</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action Logic</th>
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
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${role.isSystem ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-200"}`}>
                                <Shield className={`w-6 h-6 ${role.isSystem ? "text-indigo-500" : "text-slate-400"}`} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{role.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {role.isSystem ? "System Enforced" : "Custom Protocol"} • {roleKey}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.email}
                                onChange={(e: any) => toggleRoleSetting(roleKey, "email", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.whatsapp}
                                onChange={(e: any) => toggleRoleSetting(roleKey, "whatsapp", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleRowExpansion(roleKey)}
                                className={`px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isExpanded ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
                             >
                               {isExpanded ? "Hide Details" : "Action Control"}
                               <Bell className={`w-3.5 h-3.5 ml-2 ${isExpanded ? "animate-bounce" : ""}`} />
                             </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={4} className="px-12 py-8 border-t border-indigo-100/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Granular Template Override
                                  </h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Define specific triggers for this role. If unchecked, base protocol applies.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {NOTIFICATION_ACTIONS.map(action => {
                                    const actionSet = settings.actions?.[action.key] || { email: true, whatsapp: true };
                                    return (
                                      <div key={action.key} className="bg-white p-4 rounded-xl border border-indigo-100/50 flex items-center justify-between shadow-sm">
                                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                                          {action.label}
                                        </span>
                                        <div className="flex items-center gap-6">
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.email}
                                              onChange={(e: any) => toggleRoleActionSetting(roleKey, action.key, "email", e.target.checked)}
                                            />
                                            <span className="text-[9px] font-bold text-slate-400">EMAIL</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.whatsapp}
                                              onChange={(e: any) => toggleRoleActionSetting(roleKey, action.key, "whatsapp", e.target.checked)}
                                            />
                                            <span className="text-[9px] font-bold text-slate-400">WA</span>
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
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel Entity</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Email</th>
                    <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">WhatsApp</th>
                    <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {filteredUsers.map((u) => {
                    const settings: any = userSettings[u._id] || { email: true, whatsapp: true, actions: {} };
                    const isModified = modifiedUsers.has(u._id);
                    const isExpanded = expandedRows.has(u._id);

                    return (
                      <React.Fragment key={u._id}>
                        <tr className={`group transition-all ${isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50/50"} ${isModified ? 'border-l-4 border-l-indigo-500' : ''}`}>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-slate-50 border-slate-200 shadow-sm relative">
                                <UserIcon className="w-6 h-6 text-slate-400" />
                                {isModified && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">
                                  {u.firstName} {u.lastName}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {u.email} • {u.phone || 'NO PHONE'} 
                                  {u.role && <span className="ml-2 text-indigo-500/60">• {formatRoleLabel(u.role)}</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.email}
                                onChange={(e: any) => toggleUserSetting(u._id, "email", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             <div className="flex justify-center">
                              <Checkbox 
                                checked={settings.whatsapp}
                                onChange={(e: any) => toggleUserSetting(u._id, "whatsapp", e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleRowExpansion(u._id)}
                                className={`px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isExpanded ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
                             >
                               {isExpanded ? "Hide Details" : "Action Control"}
                               <Bell className={`w-3.5 h-3.5 ml-2 ${isExpanded ? "animate-bounce" : ""}`} />
                             </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-indigo-50/20">
                            <td colSpan={4} className="px-12 py-8 border-t border-indigo-100/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center">
                                    <Mail className="w-4 h-4 mr-2" />
                                    Entity Specific Triggers
                                  </h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Personalize template notifications for this specific personnel entity.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {NOTIFICATION_ACTIONS.map(action => {
                                    const actionSet = settings.actions?.[action.key] || { email: true, whatsapp: true };
                                    return (
                                      <div key={action.key} className="bg-white p-4 rounded-xl border border-indigo-100/50 flex items-center justify-between shadow-sm">
                                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                                          {action.label}
                                        </span>
                                        <div className="flex items-center gap-6">
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.email}
                                              onChange={(e: any) => toggleUserActionSetting(u._id, action.key, "email", e.target.checked)}
                                            />
                                            <span className="text-[9px] font-bold text-slate-400">EMAIL</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Checkbox 
                                              checked={actionSet.whatsapp}
                                              onChange={(e: any) => toggleUserActionSetting(u._id, action.key, "whatsapp", e.target.checked)}
                                            />
                                            <span className="text-[9px] font-bold text-slate-400">WA</span>
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
