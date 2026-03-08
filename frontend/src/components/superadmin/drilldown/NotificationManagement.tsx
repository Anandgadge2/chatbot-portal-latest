"use client";

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
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<any>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRes, rolesRes] = await Promise.all([
        apiClient.get(`/companies/${companyId}`),
        apiClient.get(`/roles?companyId=${companyId}`),
      ]);

      if (companyRes.success) {
        setCompany(companyRes.data.company);
        // Normalize Map to object for state
        const settings =
          companyRes.data.company.notificationSettings?.roles || {};
        setNotificationSettings(settings);
      }

      if (rolesRes.success) {
        // Build list of roles from database only
        const allRoles = rolesRes.data.roles || [];
        setRoles(allRoles);
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

  const toggleSetting = (
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiClient.put(`/companies/${companyId}`, {
        notificationSettings: {
          roles: notificationSettings,
        },
      });

      if (response.success) {
        toast.success("Notification settings updated successfully");
      } else {
        toast.error(response.message || "Failed to update settings");
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

  if (loading && !company) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 font-medium">
          Syncing Notification Matrix...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Card className="bg-slate-900 border-none shadow-2xl overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
        <CardHeader className="relative px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 backdrop-blur-sm">
                <Bell className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-white uppercase tracking-tight">
                  Notification Command Center
                </CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1 opacity-70">
                  Manage role-based dispatch protocols for {company?.name}
                </CardDescription>
              </div>
            </div>
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
        </CardHeader>
      </Card>

      {/* Main Controls */}
      <Card className="border-slate-200 shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b border-slate-100 px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-slate-900 font-black uppercase tracking-tight text-sm">
                Authority Dispatches
              </h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                Define which roles receive which transmission types
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search access roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 h-10 text-xs font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Designation
                  </th>
                  <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Email Relay
                  </th>
                  <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    WhatsApp Broadcast
                  </th>
                  <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Status
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
                    <tr
                      key={roleKey}
                      className="hover:bg-slate-50/30 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${role.isSystem ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-200"}`}
                          >
                            {role.isSystem ? (
                              <Shield className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">
                              {role.name}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {role.isSystem
                                ? "System Node"
                                : "Departmental Unit"}{" "}
                              • {roleKey}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Switch
                            checked={settings.email}
                            onCheckedChange={(val) =>
                              toggleSetting(roleKey, "email", val)
                            }
                            className="data-[state=checked]:bg-blue-500"
                          />
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest ${settings.email ? "text-blue-600" : "text-slate-300"}`}
                          >
                            {settings.email ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Switch
                            checked={settings.whatsapp}
                            onCheckedChange={(val) =>
                              toggleSetting(roleKey, "whatsapp", val)
                            }
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest ${settings.whatsapp ? "text-emerald-600" : "text-slate-300"}`}
                          >
                            {settings.whatsapp ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${settings.email || settings.whatsapp ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}
                        >
                          {settings.email || settings.whatsapp ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-slate-300"></div>
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {settings.email && settings.whatsapp
                              ? "Full Active"
                              : settings.email || settings.whatsapp
                                ? "Partial"
                                : "No Output"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Shield className="w-10 h-10 text-slate-400" />
                        <p className="text-xs font-black uppercase tracking-widest">
                          No Authority Units Detected
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
            Access Control Protocol
          </h4>
          <p className="text-[10px] text-amber-700 font-medium leading-relaxed mt-1">
            Carefully manage these settings. Disabling notifications for
            critical roles like Company Admin or Department Admin may delay
            grievance resolution and SLA compliance. These settings override
            template level configurations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationManagement;
