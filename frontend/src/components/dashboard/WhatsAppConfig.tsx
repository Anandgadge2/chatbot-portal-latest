"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
  Save,
  MessageSquare,
  RotateCcw,
  Plus,
  Trash2,
  Bell,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

/* ------------------------------------------------------------------
   Template Definitions
------------------------------------------------------------------ */
const TEMPLATE_GROUPS = [
  {
    label: "🏛️ Grievance Notifications (Admin)",
    description: "Sent to admin staff when a grievance is submitted or assigned",
    keys: [
      {
        key: "grievance_created",
        label: "Grievance Received",
        to: "Department Admin & Company Admin",
        when: "A citizen submits a new grievance through the chatbot",
      },
      {
        key: "grievance_assigned",
        label: "Grievance Assigned",
        to: "Assigned Officer",
        when: "A grievance is assigned to a department officer",
      },
    ],
  },
  {
    label: "👤 Grievance Notifications (Citizen)",
    description: "Sent to citizens about their grievance status",
    keys: [
      {
        key: "grievance_confirmation",
        label: "Grievance Confirmation",
        to: "Citizen (submitter)",
        when: "Immediately after a grievance is submitted",
      },
      {
        key: "grievance_resolved",
        label: "Grievance Resolved",
        to: "Citizen (submitter)",
        when: "The assigned officer marks a grievance as resolved",
      },
      {
        key: "grievance_status_update",
        label: "Grievance Status Update",
        to: "Citizen (submitter)",
        when: "Grievance status changes",
      },
    ],
  },
  {
    label: "📅 Appointment Notifications (Admin)",
    description: "Sent to admin staff for appointment events",
    keys: [
      {
        key: "appointment_created",
        label: "Appointment Received",
        to: "Company Admin",
        when: "A citizen books an appointment through the chatbot",
      },
      {
        key: "appointment_assigned",
        label: "Appointment Assigned",
        to: "Assigned Officer",
        when: "An appointment is assigned to a staff member",
      },
    ],
  },
  {
    label: "👤 Appointment Notifications (Citizen)",
    description: "Sent to citizens about their appointment status",
    keys: [
      {
        key: "appointment_confirmation",
        label: "Appointment Confirmation",
        to: "Citizen (submitter)",
        when: "Immediately after an appointment is booked",
      },
      {
        key: "appointment_scheduled_update",
        label: "Appointment Scheduled",
        to: "Citizen (submitter)",
        when: "Admin schedules a date & time for the appointment",
      },
      {
        key: "appointment_confirmed_update",
        label: "Appointment Confirmed",
        to: "Citizen (submitter)",
        when: "Admin confirms the appointment",
      },
      {
        key: "appointment_cancelled_update",
        label: "Appointment Cancelled",
        to: "Citizen (submitter)",
        when: "Admin cancels an appointment",
      },
      {
        key: "appointment_completed_update",
        label: "Appointment Completed",
        to: "Citizen (submitter)",
        when: "Admin marks appointment as completed",
      },
      {
        key: "appointment_status_update",
        label: "Appointment Status Update",
        to: "Citizen (submitter)",
        when: "Appointment status changes",
      },
    ],
  },
];

const BUILTIN_KEYS = TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => k.key));
const KEY_META: Record<string, { label: string; to: string; when: string }> =
  Object.fromEntries(
    TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k])),
  );

const WA_PLACEHOLDERS = [
  "{companyName}", "{recipientName}", "{citizenName}", "{citizenPhone}",
  "{grievanceId}", "{appointmentId}", "{departmentName}", "{subDepartmentName}",
  "{description}", "{purpose}", "{assignedByName}", "{formattedDate}",
  "{resolvedByName}", "{formattedResolvedDate}", "{resolutionTimeText}",
  "{remarks}", "{appointmentDate}", "{appointmentTime}", "{newStatus}", "{oldStatus}"
];

interface WhatsAppConfigProps {
  companyId: string;
}

export default function WhatsAppConfig({ companyId }: WhatsAppConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<string>("grievance_created");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, templatesRes] = await Promise.all([
        apiClient.get(`/whatsapp-config/company/${companyId}`).catch(() => ({ success: false })),
        apiClient.get(`/whatsapp-config/company/${companyId}/templates`).catch(() => ({ success: false })),
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
      } else {
        setConfig(makeEmptyConfig());
        setIsEditing(true);
      }

      const list = (templatesRes as any)?.data ?? (templatesRes as any);
      if (Array.isArray(list) && list.length > 0) {
        setWaTemplates(list);
      } else {
        setWaTemplates(BUILTIN_KEYS.map(key => ({ templateKey: key, label: KEY_META[key]?.label || key, message: "" })));
      }
    } catch (error) {
      toast.error("Failed to load WhatsApp configuration");
    } finally {
      setLoading(false);
    }
  };

  const makeEmptyConfig = () => ({
    companyId,
    phoneNumber: "",
    displayPhoneNumber: "",
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    verifyToken: "",
    chatbotSettings: { isEnabled: true, defaultLanguage: "en", supportedLanguages: ["en"] },
    isActive: true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = config._id ? "put" : "post";
      const url = config._id ? `/whatsapp-config/${config._id}` : "/whatsapp-config";
      await apiClient[method](url, config);
      toast.success("Configuration saved");
      setIsEditing(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const currentTemplate = waTemplates.find(t => t.templateKey === selectedWaTemplate) || { templateKey: selectedWaTemplate, message: "" };

  const updateTemplateMessage = (message: string) => {
    setWaTemplates(prev => {
      const exists = prev.some(t => t.templateKey === selectedWaTemplate);
      if (exists) {
        return prev.map(t => t.templateKey === selectedWaTemplate ? { ...t, message } : t);
      }
      return [...prev, { templateKey: selectedWaTemplate, message }];
    });
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates.filter(t => t.message)
      });
      toast.success("Templates saved");
    } catch (error) {
      toast.error("Failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              WhatsApp API Credentials
            </CardTitle>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-white">Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Config"}</Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input value={config.phoneNumberId} onChange={e => setConfig({...config, phoneNumberId: e.target.value})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>Business Account ID</Label>
            <Input value={config.businessAccountId} onChange={e => setConfig({...config, businessAccountId: e.target.value})} disabled={!isEditing} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>System Access Token</Label>
            <Input type="password" value={config.accessToken} onChange={e => setConfig({...config, accessToken: e.target.value})} disabled={!isEditing} />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch checked={config.isActive} onCheckedChange={v => setConfig({...config, isActive: v})} disabled={!isEditing} />
            <Label>Active</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            WhatsApp Notification Templates
          </CardTitle>
          <Button size="sm" onClick={handleSaveTemplates} disabled={savingTemplates}>{savingTemplates ? "Saving..." : "Save Templates"}</Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Select Event</Label>
              <select 
                value={selectedWaTemplate} 
                onChange={e => setSelectedWaTemplate(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TEMPLATE_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.keys.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message Content</Label>
            <textarea 
              value={currentTemplate.message}
              onChange={e => updateTemplateMessage(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-input bg-slate-950 text-emerald-400 px-4 py-3 text-sm font-mono leading-relaxed"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
             <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Available Placeholders</p>
             <div className="flex flex-wrap gap-1.5">
               {WA_PLACEHOLDERS.map(ph => (
                 <button 
                  key={ph} 
                  onClick={() => updateTemplateMessage(currentTemplate.message + ph)}
                  className="px-2 py-1 text-[10px] bg-white border border-slate-200 rounded hover:bg-slate-50 font-mono"
                 >
                   {ph}
                 </button>
               ))}
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
