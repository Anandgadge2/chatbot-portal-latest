"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import {
  Loader2,
  Save,
  MessageSquare,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  Layout,
  RefreshCw,
  Clock,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

const TEMPLATE_GROUPS = [
  {
    label: "🏛️ Grievance Notifications (Admin)",
    description: "Sent to admin staff and department hierarchy",
    keys: [
      {
        key: "grievance_created_admin",
        label: "Grievance Received (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A citizen submits a new grievance through the chatbot",
      },
      {
        key: "grievance_assigned_admin",
        label: "Grievance Assigned (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is assigned to a department officer",
      },
      {
        key: "grievance_resolved_admin",
        label: "Grievance Resolved (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as RESOLVED by an officer",
      },
      {
        key: "grievance_rejected_admin",
        label: "Grievance Rejected (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as REJECTED",
      },
    ],
  },
  {
    label: "👤 Grievance Notifications (Citizen)",
    description: "Sent to citizens about their grievance status",
    keys: [
      {
        key: "grievance_confirmation",
        label: "Grievance Confirmation (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after a grievance is submitted",
      },
      {
        key: "grievance_status_update",
        label: "Grievance Status Update (Citizen)",
        to: "Citizen (submitter)",
        when: "Grievance status changes (e.g. Assigned, Forwarded, Pending)",
      },
      {
        key: "grievance_resolved",
        label: "Grievance Resolved (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is successfully resolved",
      },
      {
        key: "grievance_rejected",
        label: "Grievance Rejected (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is rejected/closed without resolution",
      },
    ],
  },
  {
    label: "📅 Appointment Notification (Company Admin)",
    description: "Sent to company admin for appointment events",
    keys: [
      {
        key: "appointment_created_admin",
        label: "Appointment Received (Company Admin)",
        to: "Company Admin",
        when: "A citizen books an appointment through the chatbot",
      },
      {
        key: "appointment_confirmed_admin",
        label: "Appointment Confirmed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is confirmed/scheduled",
      },
      {
        key: "appointment_cancelled_admin",
        label: "Appointment Cancelled (Company Admin)",
        to: "Company Admin",
        when: "An appointment is cancelled",
      },
      {
        key: "appointment_completed_admin",
        label: "Appointment Completed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is marked as completed",
      },
    ],
  },
  {
    label: "👤 Appointment Notification (Citizen)",
    description: "Sent to citizens about their appointment status",
    keys: [
      {
        key: "appointment_confirmation",
        label: "Appointment Requested (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after an appointment is booked",
      },
      {
        key: "appointment_scheduled_update",
        label: "Appointment Scheduled (Citizen)",
        to: "Citizen (submitter)",
        when: "Admin schedules a date & time for the appointment",
      },
      {
        key: "appointment_cancelled_update",
        label: "Appointment Cancelled (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is cancelled by the admin",
      },
      {
        key: "appointment_completed_update",
        label: "Appointment Completed (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is successfully completed",
      },
    ],
  },
  {
    label: "⌨️ Chatbot Command Responses",
    description: "Instant replies when a user types a command word",
    keys: [
      {
        key: "cmd_stop",
        label: "Stop / End Conversation",
        to: "Citizen (submitter)",
        when: 'User types "stop", "quit", "exit", etc.',
      },
      {
        key: "cmd_restart",
        label: "Restart Conversation",
        to: "Citizen (submitter)",
        when: 'User types "restart", "start over", etc.',
      },
      {
        key: "cmd_menu",
        label: "Main Menu",
        to: "Citizen (submitter)",
        when: 'User types "menu", "home", "main", etc.',
      },
      {
        key: "cmd_back",
        label: "Go Back",
        to: "Citizen (submitter)",
        when: 'User types "back", "previous", etc.',
      },
    ],
  },
];

// Flat list of all built-in keys for quick lookup
const BUILTIN_KEYS = TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

// Lookup map: key → metadata
const KEY_META: Record<string, { label: string; to: string; when: string }> =
  Object.fromEntries(
    TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k])),
  );

const WA_PLACEHOLDERS: Array<{
  ph: string;
  desc: string;
  relevance: string[];
}> = [
  {
    ph: "{companyName}",
    desc: "Organisation name (e.g. Collectorate Jharsuguda)",
    relevance: ["all"],
  },
  {
    ph: "{recipientName}",
    desc: "Name of the person receiving this message",
    relevance: ["all"],
  },
  {
    ph: "{citizenName}",
    desc: "Name of the citizen who submitted",
    relevance: ["all"],
  },
  {
    ph: "{citizenPhone}",
    desc: "Citizen's contact phone number",
    relevance: ["all"],
  },
  {
    ph: "{grievanceId}",
    desc: "Unique grievance reference ID",
    relevance: ["grievance"],
  },
  {
    ph: "{appointmentId}",
    desc: "Unique appointment reference ID",
    relevance: ["appointment"],
  },
  {
    ph: "{departmentName}",
    desc: "Primary department name",
    relevance: ["all"],
  },
  {
    ph: "{subDepartmentName}",
    desc: "Sub-department name (e.g. Revenue Section)",
    relevance: ["all"],
  },
  {
    ph: "{description}",
    desc: "Grievance description text",
    relevance: ["grievance"],
  },
  {
    ph: "{purpose}",
    desc: "Purpose of the appointment",
    relevance: ["appointment"],
  },
  {
    ph: "{assignedByName}",
    desc: "Name of the admin who did the assignment",
    relevance: ["assigned"],
  },
  {
    ph: "{formattedDate}",
    desc: "Date & time (created / assigned on)",
    relevance: ["all"],
  },
  {
    ph: "{resolvedByName}",
    desc: "Name of the officer who resolved it",
    relevance: ["resolved"],
  },
  {
    ph: "{formattedResolvedDate}",
    desc: "Date & time when resolved",
    relevance: ["resolved"],
  },
  {
    ph: "{resolutionTimeText}",
    desc: "Time taken to resolve (e.g. '2 days and 3 hours')",
    relevance: ["resolved"],
  },
  {
    ph: "{remarks}",
    desc: "Officer's resolution remarks / notes",
    relevance: ["resolved", "cancelled"],
  },
  {
    ph: "{appointmentDate}",
    desc: "Formatted appointment date (for scheduled events)",
    relevance: ["appointment"],
  },
  {
    ph: "{appointmentTime}",
    desc: "Formatted appointment time in 12-hr format",
    relevance: ["appointment"],
  },
  { ph: "{newStatus}", desc: "Updated status label", relevance: ["status"] },
  { ph: "{oldStatus}", desc: "Previous status label", relevance: ["status"] },
];

const DEFAULT_WA_MESSAGES: Record<string, string> = {
  grievance_created_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *NEW GRIEVANCE RECEIVED*

Respected {recipientName},
A new grievance has been submitted by a citizen.

*Details:*
🎫 *Reference ID:* {grievanceId}
👤 *Citizen Name:* {citizenName}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📝 *Description:*
{description}
📅 *Received On:* {formattedDate}

*Action Required:*
Please review this grievance promptly. Resolution should be provided as per SLA.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_assigned_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *GRIEVANCE ASSIGNED TO YOU*

Respected {recipientName},

Details:
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📝 *Description:*
{description}
👨💼 *Assigned By:* {assignedByName}
📅 *Assigned On:* {formattedDate}

Please investigate and take required action.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Grievance Redressal System`,

  grievance_resolved_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE RESOLVED*

Respected {recipientName},

The following grievance has been marked as *RESOLVED*.

*Details:*
🎫 *Reference ID:* {grievanceId}
👤 *Citizen:* {citizenName}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📊 *Status:* RESOLVED
👨💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}
⏱️ *Time Taken:* {resolutionTimeText}
📝 *Resolution Remarks:*
{remarks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Digital Grievance System*`,

  grievance_rejected_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *GRIEVANCE REJECTED*

Respected {recipientName},

The following grievance has been *REJECTED*.

*Details:*
🎫 *Ref No:* {grievanceId}
👤 *Citizen:* {citizenName}
🏢 *Department:* {departmentName}
📊 *Status:* REJECTED
👨💼 *Action By:* {resolvedByName}
📝 *Reason:* {remarks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*`,

  grievance_confirmation: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE SUBMITTED SUCCESSFULLY*

Respected {citizenName},
Thank you for reaching out. Your grievance has been registered.
*Details:*
🎫 *Reference ID:* {grievanceId}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📅 *Submitted On:* {formattedDate}

You can track your status using the Reference ID: *{grievanceId}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your grievance, our priority.
– District Administration, Jharsuguda`,

  grievance_status_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *GRIEVANCE STATUS UPDATE*

Respected {citizenName},

Your grievance status has been updated.

*Details:*
🎫 *Ref No:* {grievanceId}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📊 *New Status:* {newStatus}
📝 *Remarks:* {remarks}

You will receive further updates via WhatsApp.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Grievance Redressal System`,

  grievance_resolved: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *GRIEVANCE RESOLVED*

Respected {citizenName},

🎫 *Reference ID:* {grievanceId}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📊 *Status:* RESOLVED
👨💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}
📝 *Remarks:* {remarks}

Thank you for your patience.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Grievance Redressal System`,

  grievance_rejected: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *GRIEVANCE REJECTED*

Respected {citizenName},

We regret to inform you that your grievance has been rejected.

*Details:*
🎫 *Ref No:* {grievanceId}
🏢 *Department:* {departmentName}
📊 *Status:* REJECTED
📝 *Remarks:* {remarks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*`,

  appointment_created_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *NEW APPOINTMENT RECEIVED*

Respected {recipientName},

Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}
🎯 *Purpose:* {purpose}
📅 *Received On:* {formattedDate}

*Action Required:*
Please review this appointment promptly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System
This is an automated notification.`,

  appointment_confirmed_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT CONFIRMED*

Respected {recipientName},

Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}
🎯 *Purpose:* {purpose}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*`,

  appointment_cancelled_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *APPOINTMENT CANCELLED*

Respected {recipientName},

The following appointment has been *CANCELLED*.

*Details:*
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}
🎯 *Purpose:* {purpose}
📊 *Status:* CANCELLED
👨💼 *Updated By:* {resolvedByName}
📅 *Updated On:* {formattedResolvedDate}
📝 *Cancellation Remarks:*
{remarks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Digital Appointment System*`,

  appointment_completed_admin: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {recipientName},

The following appointment has been marked as *COMPLETED*.

*Details:*
🎫 *Reference ID:* {appointmentId}
👤 *Citizen:* {citizenName}
🎯 *Purpose:* {purpose}
📊 *Status:* COMPLETED
👨💼 *Completed By:* {resolvedByName}
📅 *Completed On:* {formattedResolvedDate}
📝 *Resolution Remarks:*
{remarks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Digital Appointment System*`,

  appointment_confirmation: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT REQUESTED SUCCESSFULLY*

Respected {citizenName},

Your appointment request has been received.

*Details:*
🎫 *Reference ID:* {appointmentId}
🎯 *Purpose:* {purpose}
📅 *Booked On:* {formattedDate}

Please note your Reference ID: *{appointmentId}*
We will notify you once it's scheduled/confirmed.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_scheduled_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *APPOINTMENT SCHEDULED*

Respected {citizenName},

Your appointment has been scheduled.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}
🎯 *Purpose:* {purpose}
📊 *Status:* SCHEDULED
📝 *Remarks:* {remarks}

Please wait for final confirmation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_confirmed_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT CONFIRMED*

Respected {citizenName},

Your appointment has been confirmed.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}
🎯 *Purpose:* {purpose}
📊 *Status:* CONFIRMED
📝 *Remarks:* {remarks}

Please arrive 15 minutes early with valid ID.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_cancelled_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *APPOINTMENT CANCELLED*

Respected {citizenName},

We regret to inform you that your appointment has been cancelled.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}
🎯 *Purpose:* {purpose}
📝 *Remarks:* {remarks}

We apologize for any inconvenience caused.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_completed_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {citizenName},

Your appointment has been marked as completed.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}
📝 *Remarks:* {remarks}

Thank you for visiting us.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_status_update: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *APPOINTMENT STATUS UPDATE*

Respected {citizenName},

Your appointment status has been updated.

*Details:*
🎫 *Ref No:* {appointmentId}
📊 *New Status:* {newStatus}
📝 *Remarks:* {remarks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  cmd_stop:
    "🛑 Conversation ended. Thank you for using our service. You can type 'hi' at any time to start again.",
  cmd_restart: "🔄 Restarting the conversation... please wait.",
  cmd_menu: "🏠 Returning to the main menu.",
  cmd_back: "🔙 Going back to the previous step.",
};

export default function WhatsAppConfigPage() {
  const params = useParams();
  const companyId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { company, setCompany } = useCompanyContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Record<string, { notificationTemplateName: string; isActive: boolean }>>({});
  const [activeTab, setActiveTab] = useState("templates");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/companies/${companyId}`);
      if (res.success) {
        setCompany(res.data);
        const existingTemplates = res.data.whatsappConfig?.customNotifications || {};
        const normalized: any = {};
        
        // Ensure all possible keys exist in the state
        TEMPLATE_GROUPS.forEach(group => {
          group.keys.forEach(k => {
            normalized[k.key] = existingTemplates[k.key] || { 
              notificationTemplateName: "", 
              isActive: false 
            };
          });
        });
        
        setTemplates(normalized);
      }
    } catch (error) {
      toast.error("Failed to load WhatsApp configuration");
    } finally {
      setLoading(false);
    }
  }, [companyId, setCompany]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const res = await apiClient.put(`/admin/companies/${companyId}`, {
        whatsappConfig: {
          ...company?.whatsappConfig,
          customNotifications: templates
        }
      });
      if (res.success) {
        toast.success("WhatsApp configuration saved successfully");
        setCompany(res.data);
      }
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const updateTemplate = (key: string, field: string, value: any) => {
    setTemplates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Initialising Secure Config Gateway...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto px-4 md:px-0">
      {/* Header Section */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-md shadow-inner">
              <MessageSquare className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">WhatsApp Notification Engine</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 group flex items-center gap-2">
                Configure Automated Alerts for {company?.name}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </p>
            </div>
          </div>
          <Button 
            onClick={saveConfig} 
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-2xl shadow-lg shadow-indigo-900/40 transition-all active:scale-95 group font-black uppercase text-xs tracking-widest flex items-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            {saving ? "Deploying..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Tabs / Info Header */}
      <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'templates' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Layout className="w-4 h-4" />
          Templates
        </button>
        <button 
          onClick={() => setActiveTab("placeholders")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'placeholders' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Smartphone className="w-4 h-4" />
          Variable Map
        </button>
      </div>

      {activeTab === "templates" ? (
        <div className="grid gap-6">
          {TEMPLATE_GROUPS.map((group, idx) => (
            <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
              <button 
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors bg-slate-50/30"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <Bell className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{group.label}</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">{group.description}</p>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100/50">
                  {collapsedGroups[group.label] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </button>

              {!collapsedGroups[group.label] && (
                <div className="p-6 grid gap-4 divide-y divide-slate-100">
                  {group.keys.map((k) => (
                    <div key={k.key} className="pt-4 first:pt-0">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{k.label}</span>
                            {templates[k.key]?.isActive && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded border border-emerald-200">Active</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">TRIGGER: {k.when}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-2 py-1 rounded border border-indigo-100">To: {k.to}</div>
                            <div className="bg-slate-50 text-slate-500 text-[8px] font-black uppercase px-2 py-1 rounded border border-slate-200">Key: {k.key}</div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                          <div className="w-full sm:w-64 space-y-1.5">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Meta Business Cloud Template</Label>
                            <Input 
                              placeholder="e.g. appointment_confirmation_v1"
                              value={templates[k.key]?.notificationTemplateName || ""}
                              onChange={(e) => updateTemplate(k.key, "notificationTemplateName", e.target.value)}
                              className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs focus:ring-indigo-500/20"
                            />
                            <p className="text-[9px] text-slate-400 font-medium px-1 italic">Must match specific template name in Meta Business Suite</p>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50 self-start sm:self-center">
                            <Switch 
                              checked={templates[k.key]?.isActive}
                              onCheckedChange={(checked) => updateTemplate(k.key, "isActive", checked)}
                              className="data-[state=active]:bg-indigo-600"
                            />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bot Status</span>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${templates[k.key]?.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                                {templates[k.key]?.isActive ? "Active" : "Disabled"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Default Preview Section */}
                      <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200/60 relative group">
                        <div className="absolute top-4 right-4 text-[8px] font-black uppercase text-indigo-400 opacity-30 group-hover:opacity-100 transition-opacity">System Default Logic</div>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <Smartphone className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-slate-700 italic leading-relaxed">&quot;{DEFAULT_WA_MESSAGES[k.key]}&quot;</p>
                            <p className="text-[8px] text-slate-400 font-medium uppercase tracking-widest">Preview: Parameters will be dynamically injected at runtime</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="p-8 bg-slate-900 text-white flex items-center gap-6">
             <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
               <Info className="w-8 h-8 text-indigo-400" />
             </div>
             <div>
               <h2 className="text-xl font-black uppercase tracking-tight">Template Hierarchy & Variables</h2>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Guide to Meta Template Parameter Standardisation</p>
             </div>
           </div>

           <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {WA_PLACEHOLDERS.map((p) => (
                  <div key={p.ph} className="bg-slate-50 p-5 md:p-6 rounded-3xl border border-slate-200 group hover:border-indigo-200 transition-all hover:bg-white hover:shadow-lg">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                      <RefreshCw className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                    </div>
                    <p className="text-lg md:text-xl font-black text-slate-900 tracking-tighter mb-1 font-mono break-all">{p.ph}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.desc}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl bg-indigo-50 border border-indigo-100 p-8 space-y-4">
                 <div className="flex items-center gap-3">
                   <Layout className="w-5 h-5 text-indigo-600" />
                   <h3 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Critical Implementation Rules</h3>
                 </div>
                 <div className="grid md:grid-cols-2 gap-8 mt-4">
                   <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-black">1</div>
                        <p className="text-xs text-indigo-800 font-medium leading-relaxed">WhatsApp templates must be created and approved within your **Meta Business Suite Account** before activation here.</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-black">2</div>
                        <p className="text-xs text-indigo-800 font-medium leading-relaxed">Template names must match **EXACTLY** (including underscores and version numbers) as they appear in Meta&apos;s dashboard.</p>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-black">3</div>
                        <p className="text-xs text-indigo-800 font-medium leading-relaxed">Ensure placeholders like {"{{name}}"} are mapped to the correct dynamic fields in your Meta template configuration.</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-black">4</div>
                        <p className="text-xs text-indigo-800 font-medium leading-relaxed">Deactivating a template here will result in the system falling back to **SMS** or **Email** protocols (if configured).</p>
                      </div>
                   </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Persistence Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl p-4 shadow-3xl border border-white/10 flex items-center justify-between">
           <div className="flex items-center gap-4 px-4">
              <div className="relative">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              </div>
              <div>
                <p className="text-white text-[10px] font-black uppercase tracking-tight">Configuration Snapshot</p>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5">Ready for global deployment</p>
              </div>
           </div>
           <Button 
            onClick={saveConfig} 
            disabled={saving}
            className="bg-white hover:bg-slate-100 text-slate-900 px-8 h-12 rounded-2xl shadow-xl transition-all active:scale-95 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 group"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Deploying..." : "Update Engine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
