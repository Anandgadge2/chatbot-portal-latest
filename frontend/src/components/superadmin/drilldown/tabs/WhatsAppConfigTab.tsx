"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
  Save,
  Phone,
  MessageSquare,
  FileText,
  RotateCcw,
  Plus,
  Trash2,
  HelpCircle,
  Bell,
  Info,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  getPhoneNumberFormats,
  isValidPhoneNumber,
} from "@/lib/utils/phoneNumber";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Template Definitions
   Built-in system keys + any custom ones the company can create.
   Grouped by category for clarity.
------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   Available placeholders with descriptions
------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   Default system message bodies
------------------------------------------------------------------ */
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
*{companyName}*
Digital Grievance Redressal System`,

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


export interface WhatsAppConfigTabProps {
  companyId: string;
}

export default function WhatsAppConfigTab({ companyId }: WhatsAppConfigTabProps) {
  const { user } = useAuth();
  const { company } = useCompanyContext();
  const { data: cachedConfig } = useWhatsappConfig(companyId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Templates state
  const [waTemplates, setWaTemplates] = useState<
    Array<{
      templateKey: string;
      label?: string;
      message?: string;
      keywords?: string[];
      isActive?: boolean;
    }>
  >([]);
  const [selectedWaTemplate, setSelectedWaTemplate] =
    useState<string>("grievance_created_admin");
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Add new custom template
  const [newTemplateKey, setNewTemplateKey] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

  // Keywords input state (local to avoid typing issues with arrays)
  const [keywordsInput, setKeywordsInput] = useState("");

  // Group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    TEMPLATE_GROUPS.reduce((acc, g) => ({ ...acc, [g.label]: true }), {}),
  );
  const [isCustomCollapsed, setIsCustomCollapsed] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setIsEditing(false);
    }
  }, [cachedConfig]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [templatesRes] = await Promise.all([
        apiClient
          .get(`/whatsapp-config/company/${companyId}/templates`)
          .catch(() => ({ success: false })),
      ]);

      if (!cachedConfig) {
        setConfig(makeEmptyConfig());
        setIsEditing(true);
      }

      // Process Templates
      const list = (templatesRes as any)?.data ?? (templatesRes as any);
      
      // Ensure all BUILTIN_KEYS are present with at least default content
      const mergedTemplates = BUILTIN_KEYS.map(key => {
        const existing = Array.isArray(list) ? list.find((t: any) => t.templateKey === key) : null;
        if (existing) return existing;
        return {
          templateKey: key,
          label: KEY_META[key]?.label ?? key,
          message: DEFAULT_WA_MESSAGES[key] || "",
          keywords: [],
          isActive: true
        };
      });

      // Add any custom templates that were not in BUILTIN_KEYS
      if (Array.isArray(list)) {
        list.forEach((t: any) => {
          if (!BUILTIN_KEYS.includes(t.templateKey)) {
            mergedTemplates.push(t);
          }
        });
      }

      setWaTemplates(mergedTemplates);

    } catch (error: any) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  function makeEmptyConfig() {
    return {
      companyId,
      phoneNumber: "",
      displayPhoneNumber: "",
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      verifyToken: "",
      chatbotSettings: {
        isEnabled: true,
        defaultLanguage: "en",
        supportedLanguages: ["en"],
        welcomeMessage: "Welcome! How can we help you today?",
        businessHours: {
          enabled: false,
          timezone: "Asia/Kolkata",
          schedule: [],
        },
      },
      rateLimits: {
        messagesPerMinute: 60,
        messagesPerHour: 1000,
        messagesPerDay: 10000,
      },
      isActive: true,
    };
  }

  function makeDefaultTemplateSlots() {
    return BUILTIN_KEYS.map((key) => ({
      templateKey: key,
      label: KEY_META[key]?.label ?? key,
      message: DEFAULT_WA_MESSAGES[key] || "",
      keywords: [],
      isActive: true,
    }));
  }

  /* ---- Save WhatsApp API config ---- */
  const handleSave = async () => {
    try {
      setSaving(true);
      let existingConfigId = config._id;
      if (!existingConfigId) {
        try {
          const existingRes = await apiClient.get(
            `/whatsapp-config/company/${companyId}`,
          );
          const d = existingRes.success ? existingRes.data : existingRes.data;
          if (d?._id) existingConfigId = d._id;
        } catch (_) {}
      }
      const url = existingConfigId
        ? `/whatsapp-config/${existingConfigId}`
        : "/whatsapp-config";
      const method = existingConfigId ? "put" : "post";
      const res = await apiClient[method](url, config);

      if (res?.success === true) {
        toast.success(res.message || "WhatsApp configuration saved");
        setIsEditing(false);
        fetchData();
      } else if (res?.data) {
        toast.success("WhatsApp configuration saved");
        setIsEditing(false);
        fetchData();
      } else {
        toast.error(res?.message || "Failed to save configuration");
      }
    } catch (error: any) {
      let errorMessage = "Failed to save configuration";
      if (error.response?.data?.message)
        errorMessage = error.response.data.message;
      else if (error.message) errorMessage = error.message;

      if (
        error.response?.status === 400 &&
        errorMessage.includes("already exists")
      ) {
        try {
          const existingRes = await apiClient.get(
            `/whatsapp-config/company/${companyId}`,
          );
          const existingConfig = existingRes.success
            ? existingRes.data
            : existingRes.data;
          if (existingConfig?._id) {
            const updateRes = await apiClient.put(
              `/whatsapp-config/${existingConfig._id}`,
              config,
            );
            if (updateRes?.success) {
              toast.success("WhatsApp configuration updated");
              setIsEditing(false);
              fetchData();
              return;
            }
            toast.error(updateRes?.message || "Failed to update configuration");
          }
        } catch (retryError: any) {
          toast.error(
            retryError.response?.data?.message ||
              "Failed to update configuration",
          );
        }
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---- Save templates ---- */
  const handleSaveWhatsAppTemplates = async () => {
    try {
      setSavingTemplates(true);
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates
          .filter((t) => t.message || t.keywords?.length)
          .map((t) => ({
            templateKey: t.templateKey,
            label: t.label || t.templateKey,
            message: t.message || "",
            keywords: t.keywords || [],
            isActive: t.isActive !== false,
          })),
      });
      toast.success("WhatsApp notifications updated");
      fetchData();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to save templates",
      );
    } finally {
      setSavingTemplates(false);
    }
  };

  const currentWaTemplate =
    waTemplates.find((t) => t.templateKey === selectedWaTemplate) || {
      templateKey: selectedWaTemplate,
      message: DEFAULT_WA_MESSAGES[selectedWaTemplate] || "",
      keywords: [],
      isActive: true,
    };

  const updateSelectedField = (
    field: "message" | "keywords" | "isActive",
    value: any,
  ) => {
    setWaTemplates((prev) => {
      const existingIdx = prev.findIndex(
        (t) => t.templateKey === selectedWaTemplate,
      );
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], [field]: value };
        return next;
      }
      return [
        ...prev,
        {
          templateKey: selectedWaTemplate,
          label: KEY_META[selectedWaTemplate]?.label || selectedWaTemplate,
          [field]: value,
          isActive: true,
        },
      ];
    });
  };

  const addPlaceholder = (ph: string) => {
    const existing = currentWaTemplate.message || "";
    updateSelectedField("message", existing + ph);
  };

  const handleAddTemplate = () => {
    if (!newTemplateKey || !newTemplateLabel) {
      toast.error("Both key and label are required");
      return;
    }
    const slug = newTemplateKey
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (waTemplates.some((t) => t.templateKey === slug)) {
      toast.error("Template key already exists");
      return;
    }
    setWaTemplates((prev) => [
      ...prev,
      { templateKey: slug, label: newTemplateLabel, keywords: [] },
    ]);
    setSelectedWaTemplate(slug);
    setNewTemplateKey("");
    setNewTemplateLabel("");
    setIsAddingTemplate(false);
    toast.success("Added! Now customize the message and keywords.");
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner text="Retrieving matrix configuration..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Action Bar (Sticky-ish) */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
           <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">WhatsApp API Config</h2>
           <p className="text-[10px] text-slate-500 font-medium">Configure Meta Business integration</p>
        </div>
        <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-lg"
              >
                Edit Parameters
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 px-4 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Deploying..." : "Commit Changes"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    fetchData();
                  }}
                  className="h-8 text-[10px] text-slate-500"
                >
                  Cancel
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Main Grid: Parameters vs Designer */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Col: Setup & Core Parameters */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="rounded-xl border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-900 border-b border-slate-800 py-3">
              <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                Connection Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Official Phone Number *
                  </Label>
                  <Input
                    placeholder="+919999999999"
                    value={config?.phoneNumber || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        phoneNumber: e.target.value,
                        displayPhoneNumber: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    className="h-9 text-xs font-bold border-slate-200"
                  />
                  <p className="text-[9px] text-slate-400 font-medium italic">
                    Format: +[CountryCode][Number] (e.g. +919876543210)
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Messenger Pipeline
                    </Label>
                    <Switch
                      checked={config?.chatbotSettings?.isEnabled}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          chatbotSettings: {
                            ...config.chatbotSettings,
                            isEnabled: checked,
                          },
                        })
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">
                    Automatically handle inbound messages through chatbot flows
                  </p>
                </div>

                {isEditing && (
                  <div className="pt-2 mt-2 border-t border-slate-100 space-y-3">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-8 px-0 text-indigo-600 hover:text-indigo-700 hover:bg-transparent text-[10px] font-bold group"
                      onClick={() => {}}
                    >
                      <Plus className="w-3 h-3 mr-2 group-hover:scale-125 transition-all" />
                      Advanced Integration Meta...
                    </Button>

                    <div className="grid gap-3 animate-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-slate-400">
                          Phone Number ID
                        </Label>
                        <Input
                          value={config?.phoneNumberId || ""}
                          onChange={(e) =>
                            setConfig({ ...config, phoneNumberId: e.target.value })
                          }
                          className="h-8 text-[10px] bg-slate-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-slate-400">
                          Biz Account ID
                        </Label>
                        <Input
                          value={config?.businessAccountId || ""}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              businessAccountId: e.target.value,
                            })
                          }
                          className="h-8 text-[10px] bg-slate-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase text-slate-400">
                          Cloud Access Token
                        </Label>
                        <Input
                          type="password"
                          value={config?.accessToken || ""}
                          onChange={(e) =>
                            setConfig({ ...config, accessToken: e.target.value })
                          }
                          className="h-8 text-[10px] bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Center/Right Col: Notifications Designer */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="rounded-xl border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-900 border-b border-slate-800 py-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                  Outbound Notification Designer
                </CardTitle>
              </div>
              <Button
                onClick={handleSaveWhatsAppTemplates}
                disabled={savingTemplates}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-7 px-3 text-[9px] font-black uppercase tracking-widest border-0"
              >
                {savingTemplates ? "Synchronizing..." : "Update Logic"}
              </Button>
            </CardHeader>

            <CardContent className="p-0 flex flex-col md:flex-row min-h-[500px]">
              {/* Template Navigator */}
              <div className="w-full md:w-64 border-r border-slate-100 bg-white">
                <div className="p-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Available Keys
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-white rounded-md text-indigo-600"
                    onClick={() => setIsAddingTemplate(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="overflow-y-auto max-h-[600px] no-scrollbar">
                  {TEMPLATE_GROUPS.map((group) => {
                    const isCollapsed = collapsedGroups[group.label];
                    return (
                      <div key={group.label} className="border-b border-slate-200 last:border-0">
                        <div
                          onClick={() => toggleGroup(group.label)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            {group.label}
                          </span>
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="pb-1">
                            {group.keys.map((k) => {
                              const template = waTemplates.find(
                                (t) => t.templateKey === k.key,
                              );
                              const hasContent = !!(
                                template?.message && template.message.trim()
                              );
                              const isActive = template?.isActive !== false;

                              return (
                                <div
                                  key={k.key}
                                  className="group/item relative"
                                >
                                  <div
                                    onClick={() => setSelectedWaTemplate(k.key)}
                                    className={cn(
                                      "w-full flex flex-col px-4 py-3 transition-all border-l-2 cursor-pointer",
                                      selectedWaTemplate === k.key
                                        ? "bg-indigo-50/50 border-indigo-500"
                                        : "bg-transparent border-transparent hover:bg-slate-50",
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full mb-1">
                                      <span
                                        className={cn(
                                          "text-[11px] font-bold truncate pr-2",
                                          selectedWaTemplate === k.key
                                            ? "text-indigo-700"
                                            : "text-slate-700",
                                        )}
                                      >
                                        {k.label}
                                      </span>
                                      <Switch
                                        checked={isActive}
                                        onCheckedChange={(checked) => {
                                          setSelectedWaTemplate(k.key);
                                          updateSelectedField("isActive", checked);
                                        }}
                                        className="h-4 w-7"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={cn(
                                          "text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter",
                                          isActive
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-slate-200 text-slate-500",
                                        )}
                                      >
                                        {isActive ? "Active" : "Inactive"}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-medium truncate">
                                        To: {k.to}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {waTemplates.filter((t) => !BUILTIN_KEYS.includes(t.templateKey))
                    .length > 0 && (
                    <div className="border-t border-slate-100">
                      <div
                        onClick={() => setIsCustomCollapsed(!isCustomCollapsed)}
                        className="w-full px-6 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between transition-colors group cursor-pointer"
                      >
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 text-emerald-500" />
                          Custom Scenarios
                        </span>
                        {isCustomCollapsed ? (
                          <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        )}
                      </div>
                      {!isCustomCollapsed && (
                        <div className="bg-white">
                          {waTemplates
                            .filter((t) => !BUILTIN_KEYS.includes(t.templateKey))
                            .map((t) => {
                              const isActive = t.isActive !== false;
                              return (
                                <div key={t.templateKey} className="group/item relative">
                                  <div
                                    onClick={() => setSelectedWaTemplate(t.templateKey)}
                                    className={cn(
                                      "w-full flex flex-col px-6 py-3 transition-all border-l-2 text-left cursor-pointer",
                                      selectedWaTemplate === t.templateKey
                                        ? "bg-indigo-50/50 border-indigo-600 shadow-inner"
                                        : "bg-transparent border-transparent hover:bg-slate-50",
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold truncate pr-3",
                                          selectedWaTemplate === t.templateKey
                                            ? "text-indigo-700"
                                            : "text-slate-700",
                                        )}
                                      >
                                        {t.label || t.templateKey}
                                      </span>
                                      <Switch
                                        checked={isActive}
                                        onCheckedChange={(checked) => {
                                          setSelectedWaTemplate(t.templateKey);
                                          updateSelectedField("isActive", checked);
                                        }}
                                        className="h-3 w-6"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate opacity-70 group-hover/item:opacity-100 transition-opacity">
                                        {t.templateKey}
                                      </span>
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setWaTemplates((prev) =>
                                            prev.filter(
                                              (x) => x.templateKey !== t.templateKey,
                                            ),
                                          );
                                          if (selectedWaTemplate === t.templateKey)
                                            setSelectedWaTemplate(BUILTIN_KEYS[0]);
                                        }}
                                        className="h-5 w-5 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer"
                                        title="Delete template"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="flex-1 bg-white p-6 relative">
                {selectedWaTemplate && (
                  <div className="space-y-5 h-full flex flex-col animate-in fade-in slide-in-from-right-2 duration-300">
                    {/* Header: Title & Logic Controls */}
                    <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                          {KEY_META[selectedWaTemplate]?.label ||
                            currentWaTemplate.label ||
                            selectedWaTemplate}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                          Triggered when:{" "}
                          <span className="text-indigo-600 font-bold italic">
                            {KEY_META[selectedWaTemplate]?.when ||
                              "custom deployment event"}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => {
                            const defaultMsg = DEFAULT_WA_MESSAGES[selectedWaTemplate] || "";
                            updateSelectedField("message", defaultMsg);
                          }}
                          variant="outline"
                          className="h-8 px-3 text-[10px] font-bold border-slate-200 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Load Default
                        </Button>
                        <Button
                          onClick={handleSaveWhatsAppTemplates}
                          disabled={savingTemplates}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-8 px-4 text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2 group/save transition-all"
                        >
                          <Save className="w-3.5 h-3.5 group-hover/save:scale-110 transition-transform" />
                          {savingTemplates ? "Saving..." : "Save Template"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      {/* Message Body Input */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
                          Message Content
                          <span className="text-[9px] font-medium normal-case flex items-center gap-1">
                            <Info className="w-3 h-3" /> Markdown & Emojis supported
                          </span>
                        </Label>
                        <textarea
                          placeholder="Type your WhatsApp notification body here..."
                          value={currentWaTemplate.message || ""}
                          onChange={(e) =>
                            updateSelectedField("message", e.target.value)
                          }
                          className="w-full min-h-[450px] p-5 text-xs font-bold font-mono border border-slate-200 rounded-2xl bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none leading-relaxed shadow-inner"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Inject Matrix Placeholders
                        </Label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          {WA_PLACEHOLDERS.map((ph) => {
                            const isRelevant =
                              ph.relevance.includes("all") ||
                              selectedWaTemplate.includes(ph.relevance[0]);
                            return (
                              <button
                                key={ph.ph}
                                onClick={() => addPlaceholder(ph.ph)}
                                className={`px-2 py-1 text-[9px] font-black rounded-lg border transition-all ${
                                  isRelevant
                                    ? "bg-white border-indigo-200 text-indigo-700 hover:border-indigo-500 hover:shadow-sm"
                                    : "bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100"
                                }`}
                                title={ph.desc}
                              >
                                {ph.ph}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Manual Trigger Tags (Only for generic templates) */}
                      {!BUILTIN_KEYS.includes(selectedWaTemplate) && (
                        <div className="space-y-2 pt-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            Inbound Keywords (Manual Trigger)
                          </Label>
                          <div className="space-y-2">
                            <Input
                              placeholder="Type keyword and press Enter (e.g. status, track)"
                              value={keywordsInput}
                              onChange={(e) => setKeywordsInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const val = keywordsInput.trim().toLowerCase();
                                  if (
                                    val &&
                                    !currentWaTemplate.keywords?.includes(val)
                                  ) {
                                    updateSelectedField("keywords", [
                                      ...(currentWaTemplate.keywords || []),
                                      val,
                                    ]);
                                    setKeywordsInput("");
                                  }
                                }
                              }}
                              className="h-9 text-xs border-slate-200"
                            />
                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                              {currentWaTemplate.keywords?.map((kw: string) => (
                                <span
                                  key={kw}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold"
                                >
                                  {kw}
                                  <button
                                    onClick={() =>
                                      updateSelectedField(
                                        "keywords",
                                        currentWaTemplate.keywords?.filter(
                                          (x: string) => x !== kw,
                                        ),
                                      )
                                    }
                                  >
                                    <X className="w-3 h-3 hover:text-red-500" />
                                  </button>
                                </span>
                              ))}
                              {(!currentWaTemplate.keywords ||
                                currentWaTemplate.keywords.length === 0) && (
                                <span className="text-[9px] text-slate-400 font-medium italic">
                                  No keywords defined. This template will only
                                  trigger manually.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Overlay: Add Template Dialog */}
                {isAddingTemplate && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <Card className="w-full max-w-sm rounded-2xl shadow-2xl border-slate-200 scale-100">
                      <CardHeader className="py-4 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-black text-slate-800 uppercase">
                            New Scenario Node
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setIsAddingTemplate(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500">
                            Unique Key (e.g. feedback_request)
                          </Label>
                          <Input
                            placeholder="feedback_v1"
                            value={newTemplateKey}
                            onChange={(e) => setNewTemplateKey(e.target.value)}
                            className="h-10 text-xs border-slate-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500">
                            Display Label (e.g. Citizen Feedback)
                          </Label>
                          <Input
                            placeholder="Request Feedback"
                            value={newTemplateLabel}
                            onChange={(e) => setNewTemplateLabel(e.target.value)}
                            className="h-10 text-xs border-slate-200"
                          />
                        </div>
                        <Button
                          onClick={handleAddTemplate}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 font-bold text-[11px] uppercase tracking-wider"
                        >
                          Initialize Node
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
