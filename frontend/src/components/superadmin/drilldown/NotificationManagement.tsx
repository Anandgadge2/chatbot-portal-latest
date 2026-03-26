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
  const [userSettings, setUserSettings] = useState<{ [userId: string]: { email: boolean, whatsapp: boolean } }>({});
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

  const toggleRoleSetting = (
    roleKey: string,
    type: "email" | "whatsapp",
    value: boolean,
  ) => {
    setNotificationSettings((prev: any) => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || { email: true, whatsapp: true }),
        [type]: value,
      },
    }));
  };

  const toggleUserSetting = (
    userId: string,
    type: "email" | "whatsapp",
    value: boolean,
  ) => {
    setUserSettings((prev: any) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || { email: true, whatsapp: true }),
        [type]: value,
      },
    }));
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
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      {/* Header Panel */}
      <Card className="bg-slate-900 border-none shadow-2xl overflow-hidden rounded-3xl">
        {/* Removed blue backdrop */}
        <CardHeader className="relative px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 backdrop-blur-sm">
                <Bell className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-white uppercase tracking-tight">
                  Notification Command Center
                </CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1 opacity-70">
                  Global Configuration for {company?.name} • Superadmin Control Only
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/20 active:scale-95 transition-all border-0"
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
        </CardHeader>
      </Card>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
        <div className="flex items-center justify-between">
           <TabsList className="bg-slate-900/10 p-1.5 h-12 rounded-2xl gap-2">
            <TabsTrigger 
              value="roles" 
              className="px-6 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
            >
              <Shield className="w-3.5 h-3.5 mr-2" />
              Role Logic
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="px-6 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
            >
              <UsersIcon className="w-3.5 h-3.5 mr-2" />
              Individual Ops
            </TabsTrigger>
          </TabsList>
          
          <div className="relative w-72">
            <input
              type="text"
              placeholder={activeSubTab === "roles" ? "Search access roles..." : "Search individuals..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-[11px] font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <Card className="border-slate-200 shadow-xl rounded-3xl overflow-hidden bg-white">
          <TabsContent value="roles" className="m-0">
             <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Authority Designation
                    </th>
                    <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Email Relay
                    </th>
                    <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      WhatsApp Broadcast
                    </th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Integrity Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRoles.map((role) => {
                    const roleKey = role.key || role.name;
                    const settings = notificationSettings[roleKey] || {
                      email: true,
                      whatsapp: true,
                    };

                    return (
                      <tr key={roleKey} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm ${role.isSystem ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-200"}`}>
                              <Shield className={`w-5 h-5 ${role.isSystem ? "text-indigo-500" : "text-slate-400"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">
                                {role.name}
                              </p>
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
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${settings.email || settings.whatsapp ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {settings.email && settings.whatsapp ? "SYCHRONIZED" : settings.email || settings.whatsapp ? "LIMITED" : "DORMANT"}
                            </span>
                          </div>
                        </td>
                      </tr>
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
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Personnel Entity
                    </th>
                    <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Direct Email
                    </th>
                    <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Direct WhatsApp
                    </th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Assignment Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((u) => {
                    const settings = userSettings[u._id] || { email: true, whatsapp: true };
                    const isModified = modifiedUsers.has(u._id);

                    return (
                      <tr key={u._id} className={`hover:bg-slate-50/30 transition-colors group ${isModified ? 'bg-indigo-50/20' : ''}`}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center border bg-slate-50 border-slate-200 shadow-sm">
                              <UserIcon className="w-5 h-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {u.email} • {u.phone || 'NO PHONE'}
                                {isModified && <span className="ml-2 text-indigo-500 font-black animate-pulse">[MODIFIED]</span>}
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
                          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-widest">
                            {formatRoleLabel(u.role)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Card>
      </Tabs>

      {/* Security Protocol Footer */}
      <div className="bg-indigo-950 rounded-3xl p-8 border border-indigo-500/30 relative overflow-hidden shadow-2xl">
        {/* Removed blue backdrop blob */}
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/40">
             <Shield className="w-8 h-8 text-indigo-400" />
           </div>
           <div className="flex-1 text-center md:text-left">
             <h4 className="text-white font-black uppercase tracking-tight text-lg mb-2">
               Superadmin Security Protocol
             </h4>
             <p className="text-indigo-200/60 font-medium text-xs leading-relaxed max-w-2xl">
               This interface provides absolute control over the company&apos;s communication infrastructure. 
               Changes made here override all lower-level defaults. Disabling notifications for critical 
               roles like <strong>Department Admins</strong> may severely impact citizen response times and SLA metrics. 
               Individual overrides are highlighted for clarity.
             </p>
           </div>
           <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-indigo-900/50 px-4 py-2.5 rounded-xl border border-indigo-500/20">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Global Relay</span>
              </div>
              <div className="flex items-center gap-2 bg-indigo-900/50 px-4 py-2.5 rounded-xl border border-indigo-500/20">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Direct API</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationManagement;
