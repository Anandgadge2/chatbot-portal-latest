"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
  ArrowLeft,
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
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  getPhoneNumberFormats,
  isValidPhoneNumber,
} from "@/lib/utils/phoneNumber";

/* ------------------------------------------------------------------
   Template Definitions
   Built-in system keys + any custom ones the company can create.
   Grouped by category for clarity.
------------------------------------------------------------------ */
const TEMPLATE_GROUPS = [
  {
    label: "🏛️ Grievance Notifications",
    description:
      "Sent automatically when a grievance is submitted, assigned, or resolved",
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
        when: "Grievance status changes (e.g. Pending → Assigned → Rejected)",
      },
    ],
  },
  {
    label: "📅 Appointment Notifications",
    description: "Sent automatically for appointment lifecycle events",
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
      {
        key: "appointment_resolved",
        label: "Appointment Resolved / Completed",
        to: "Citizen (submitter)",
        when: "The appointment is marked as resolved or completed",
      },
      {
        key: "appointment_scheduled",
        label: "Appointment Scheduled",
        to: "Citizen (submitter)",
        when: "Admin schedules a confirmed date & time for the appointment",
      },
      {
        key: "appointment_confirmed",
        label: "Appointment Confirmed",
        to: "Citizen (submitter)",
        when: "Admin confirms the appointment",
      },
      {
        key: "appointment_cancelled",
        label: "Appointment Cancelled",
        to: "Citizen (submitter)",
        when: "Admin cancels an appointment",
      },
      {
        key: "appointment_completed",
        label: "Appointment Completed",
        to: "Citizen (submitter)",
        when: "Admin marks appointment as completed",
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
  grievance_created: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *NEW GRIEVANCE RECEIVED*

Respected {recipientName},

Grievance Details:
🎫 *Reference ID:* {grievanceId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📝 *Description:*
{description}

📅 *Received On:* {formattedDate}

*Action Required:*
Please review this grievance at your earliest convenience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Grievance Redressal System
This is an automated notification.`,

  grievance_assigned: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *GRIEVANCE ASSIGNED TO YOU*

Respected {recipientName},

Assignment Details:
🎫 *Reference ID:* {grievanceId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}
🏢 *Department:* {departmentName}
🏢 *Sub-Dept:* {subDepartmentName}
📝 *Description:*
{description}

👨‍💼 *Assigned By:* {assignedByName}
📅 *Assigned On:* {formattedDate}

Please investigate and take required action.

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
👨‍💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedResolvedDate}
⏱️ *Resolution Time:* {resolutionTimeText}

📝 *Remarks:* {remarks}

Thank you for your patience.

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

  appointment_created: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *NEW APPOINTMENT RECEIVED*

Respected {recipientName},

Appointment Details:
🎫 *Reference ID:* {appointmentId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}
🎯 *Purpose:* {purpose}

📅 *Received On:* {formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_assigned: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *APPOINTMENT ASSIGNED TO YOU*

Respected {recipientName},

🎫 *Reference ID:* {appointmentId}
👤 *Citizen Name:* {citizenName}
📞 *Contact Number:* {citizenPhone}
🎯 *Purpose:* {purpose}

👨‍💼 *Assigned By:* {assignedByName}
📅 *Assigned On:* {formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_resolved: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {citizenName},

🎫 *Reference ID:* {appointmentId}
📊 *Status:* COMPLETED
👨‍💼 *Completed By:* {resolvedByName}
📅 *Completed On:* {formattedResolvedDate}
⏱️ *Time Taken:* {resolutionTimeText}

📝 *Remarks:* {remarks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_scheduled: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *APPOINTMENT SCHEDULED*

Respected {citizenName},

Your appointment has been scheduled.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
👤 *Name:* {citizenName}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}
🎯 *Purpose:* {purpose}
📊 *Status:* SCHEDULED

📝 *Remarks:* {remarks}

Please wait for final confirmation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  appointment_confirmed: `*{companyName}*
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

  appointment_cancelled: `*{companyName}*
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

  appointment_completed: `*{companyName}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *APPOINTMENT COMPLETED*

Respected {citizenName},

Your appointment has been marked as completed.

*Appointment Details:*
🎫 *Ref No:* {appointmentId}
📅 *Date:* {appointmentDate}
⏰ *Time:* {appointmentTime}

📝 *Remarks:* {remarks}

Thank you for visiting us. We hope your concern was addressed satisfactorily.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,

  cmd_stop:
    "🛑 Conversation ended. Thank you for using our service. You can type 'hi' at any time to start again.",
  cmd_restart: "🔄 Restarting the conversation... please wait.",
  cmd_menu: "🏠 Returning to the main menu.",
  cmd_back: "🔙 Going back to the previous step.",
};

/* ------------------------------------------------------------------
   Component
------------------------------------------------------------------ */
export default function WhatsAppConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [company, setCompany] = useState<any>(null);

  // Templates state
  const [waTemplates, setWaTemplates] = useState<
    Array<{
      templateKey: string;
      label?: string;
      message?: string;
      keywords?: string[];
    }>
  >([]);
  const [selectedWaTemplate, setSelectedWaTemplate] =
    useState<string>("grievance_created");
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Add new custom template
  const [newTemplateKey, setNewTemplateKey] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

  // Group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") {
      router.push("/superadmin/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const companyRes = await apiClient.get(`/companies/${companyId}`);
      if (companyRes.success && companyRes.data?.company) {
        setCompany(companyRes.data.company);
      } else if (companyRes.data?.company) {
        setCompany(companyRes.data.company);
      }

      try {
        const configRes = await apiClient.get(
          `/whatsapp-config/company/${companyId}`,
        );
        if (configRes.success && configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else if (configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else {
          setConfig(makeEmptyConfig());
          setIsEditing(true);
        }
      } catch (configError: any) {
        if (
          configError.response?.status === 404 ||
          configError.response?.status === 400
        ) {
          setConfig(makeEmptyConfig());
          setIsEditing(true);
        } else {
          console.error("❌ Error loading config:", configError);
          throw configError;
        }
      }

      try {
        const templatesRes = await apiClient.get<{
          success?: boolean;
          data?: Array<{
            templateKey: string;
            label?: string;
            message?: string;
            keywords?: string[];
          }>;
        }>(`/whatsapp-config/company/${companyId}/templates`);
        const list = (templatesRes as any)?.data ?? (templatesRes as any);
        if (Array.isArray(list) && list.length > 0) {
          setWaTemplates(list);
        } else {
          setWaTemplates(makeDefaultTemplateSlots());
        }
      } catch (_) {
        setWaTemplates(makeDefaultTemplateSlots());
      }
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
      keywords: [],
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
          .filter((t) => t.templateKey)
          .map((t) => ({
            templateKey: t.templateKey,
            label: t.label || t.templateKey,
            message: t.message ?? "",
            keywords: t.keywords ?? [],
          })),
      });
      toast.success("✅ Notification templates saved successfully");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  };

  /* ---- Add custom template ---- */
  const handleAddTemplate = () => {
    if (!newTemplateKey.trim()) {
      toast.error("Template key is required");
      return;
    }
    const key = newTemplateKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (waTemplates.find((t) => t.templateKey === key)) {
      toast.error("A template with this key already exists");
      return;
    }
    setWaTemplates((prev) => [
      ...prev,
      {
        templateKey: key,
        label: newTemplateLabel.trim() || newTemplateKey.trim(),
        message: "",
        keywords: [],
      },
    ]);
    setSelectedWaTemplate(key);
    setNewTemplateKey("");
    setNewTemplateLabel("");
    setIsAddingTemplate(false);
    toast.success("Custom template slot added — fill in the message and save.");
  };

  /* ---- Delete template ---- */
  const handleDeleteTemplate = async (key: string) => {
    const isBuiltin = BUILTIN_KEYS.includes(key);
    if (isBuiltin) {
      setWaTemplates((prev) =>
        prev.map((t) => (t.templateKey === key ? { ...t, message: "" } : t)),
      );
      toast.success("Built-in template cleared (will use system default)");
      return;
    }
    if (!confirm("Are you sure you want to delete this custom template?"))
      return;
    try {
      setSavingTemplates(true);
      await apiClient.delete(
        `/whatsapp-config/company/${companyId}/templates/${key}`,
      );
      setWaTemplates((prev) => prev.filter((t) => t.templateKey !== key));
      if (selectedWaTemplate === key)
        setSelectedWaTemplate("grievance_created");
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to delete template");
    } finally {
      setSavingTemplates(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      const keys = path.split(".");
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const selectedMeta = KEY_META[selectedWaTemplate];
  const selectedTemplate = waTemplates.find(
    (t) => t.templateKey === selectedWaTemplate,
  );
  const isCustom = !BUILTIN_KEYS.includes(selectedWaTemplate);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <header className="bg-slate-900 sticky top-0 z-50 shadow-2xl border-b border-slate-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/superadmin/company/${companyId}`)}
                className="text-slate-400 hover:text-white hover:bg-white/10 transition-all -ml-2 h-9 w-9 p-0 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <MessageSquare className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                  WhatsApp Matrix
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Configuration Node:{" "}
                    <span className="text-indigo-400">{company?.name}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-bold text-[11px] uppercase tracking-wider border-0"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Processing..." : "Deploy Changes"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      fetchData();
                    }}
                    className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 font-bold text-[11px] uppercase tracking-wider"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="h-10 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 font-bold text-[11px] uppercase tracking-wider"
                >
                  Modify Config
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-4 py-4">
        <div className="space-y-6">
          {/* -------------------------------------------------------
              WhatsApp Business API Credentials
          ------------------------------------------------------- */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-400" />
                Cloud API Infrastructure Credentials
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Meta Business Suite Connectivity
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number */}
                <div className="space-y-2 md:col-span-2">
                  <Label
                    htmlFor="phoneNumber"
                    className="text-sm font-semibold"
                  >
                    WhatsApp Business Phone Number
                  </Label>
                  <Input
                    id="phoneNumber"
                    placeholder="e.g., +91 95038 50561 or +1 555 194 4395"
                    value={config?.displayPhoneNumber || ""}
                    onChange={(e) => {
                      const input = e.target.value;
                      const formats = getPhoneNumberFormats(input);
                      updateConfig("displayPhoneNumber", formats.displayFormat);
                      updateConfig("phoneNumber", formats.apiFormat);
                    }}
                    onBlur={(e) => {
                      if (
                        e.target.value &&
                        !isValidPhoneNumber(e.target.value)
                      ) {
                        toast.error(
                          "Please enter a valid phone number with country code",
                        );
                      }
                    }}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 text-lg font-mono"
                  />
                  <div className="flex items-start gap-2 mt-2">
                    <div className="flex-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-semibold text-blue-700 mb-1">
                        📱 Display Format
                      </p>
                      <p className="text-sm font-mono text-blue-900">
                        {config?.displayPhoneNumber || "Not set"}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        What customers see in WhatsApp
                      </p>
                    </div>
                    <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs font-semibold text-green-700 mb-1">
                        🔧 API Format
                      </p>
                      <p className="text-sm font-mono text-green-900">
                        {config?.phoneNumber || "Not set"}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Used for Meta API calls
                      </p>
                    </div>
                  </div>
                </div>

                {/* Phone Number ID */}
                <div className="space-y-2">
                  <Label
                    htmlFor="phoneNumberId"
                    className="text-sm font-semibold"
                  >
                    Phone Number ID
                  </Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="From Meta Business Manager"
                    value={config?.phoneNumberId || ""}
                    onChange={(e) =>
                      updateConfig("phoneNumberId", e.target.value)
                    }
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Unique Phone Number ID from Meta Business Manager.
                  </p>
                </div>

                {/* Business Account ID */}
                <div className="space-y-2">
                  <Label
                    htmlFor="businessAccountId"
                    className="text-sm font-semibold"
                  >
                    Business Account ID
                  </Label>
                  <Input
                    id="businessAccountId"
                    placeholder="WhatsApp Business Account ID"
                    value={config?.businessAccountId || ""}
                    onChange={(e) =>
                      updateConfig("businessAccountId", e.target.value)
                    }
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                </div>

                {/* Access Token */}
                <div className="space-y-2 md:col-span-2">
                  <Label
                    htmlFor="accessToken"
                    className="text-sm font-semibold"
                  >
                    Access Token
                  </Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="Enter WhatsApp Access Token"
                    value={config?.accessToken || ""}
                    onChange={(e) =>
                      updateConfig("accessToken", e.target.value)
                    }
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                  {config?.accessToken && !isEditing && (
                    <p className="text-xs text-gray-500 mt-1">
                      Token is hidden for security
                    </p>
                  )}
                </div>

                {/* Verify Token */}
                <div className="space-y-2">
                  <Label
                    htmlFor="verifyToken"
                    className="text-sm font-semibold"
                  >
                    Webhook Verify Token
                  </Label>
                  <Input
                    id="verifyToken"
                    placeholder="Your webhook verification token"
                    value={config?.verifyToken || ""}
                    onChange={(e) =>
                      updateConfig("verifyToken", e.target.value)
                    }
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="isActive"
                    checked={config?.isActive || false}
                    onCheckedChange={(checked) =>
                      updateConfig("isActive", checked)
                    }
                    disabled={!isEditing}
                  />
                  <Label htmlFor="isActive" className="text-sm font-semibold">
                    Active
                  </Label>
                  {config?.isActive && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                      ✓ Active
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* -------------------------------------------------------
              WhatsApp Notification Templates
          ------------------------------------------------------- */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    WhatsApp Notification Templates
                  </CardTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Automated message content sent to citizens & admin staff
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* How it works banner */}
              <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 leading-relaxed">
                  <p className="font-semibold mb-0.5">
                    How notification templates work
                  </p>
                  <p>
                    These templates are the{" "}
                    <strong>actual WhatsApp messages</strong> sent automatically
                    to citizens and admin staff at each stage (grievance
                    received, assigned, resolved, etc.). Use placeholders like{" "}
                    <code className="bg-blue-100 px-1 rounded font-mono">
                      {"{subDepartmentName}"}
                    </code>
                    ,{" "}
                    <code className="bg-blue-100 px-1 rounded font-mono">
                      {"{resolutionTimeText}"}
                    </code>{" "}
                    to inject real data into each message. If a template is
                    empty, the system default is used.
                  </p>
                </div>
              </div>

              <div className="flex h-[calc(100vh-280px)] min-h-[600px]">
                {/* ---- Left sidebar: template browser ---- */}
                <div className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50/60">
                  {/* Add custom template */}
                  <div className="p-3 border-b border-slate-200">
                    {isAddingTemplate ? (
                      <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2 shadow-sm">
                        <p className="text-[10px] font-bold uppercase text-emerald-700">
                          New Custom Template
                        </p>
                        <Input
                          placeholder="Key (e.g. escalation_alert)"
                          value={newTemplateKey}
                          onChange={(e) => setNewTemplateKey(e.target.value)}
                          className="h-8 text-xs border-emerald-200"
                        />
                        <Input
                          placeholder="Label (e.g. Escalation Alert)"
                          value={newTemplateLabel}
                          onChange={(e) => setNewTemplateLabel(e.target.value)}
                          className="h-8 text-xs border-emerald-200"
                        />
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={handleAddTemplate}
                            className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Create
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsAddingTemplate(false)}
                            className="flex-1 h-7 text-[10px] text-slate-600"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingTemplate(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Custom Template
                      </button>
                    )}
                  </div>

                  {/* Group list */}
                  {TEMPLATE_GROUPS.map((group) => (
                    <div
                      key={group.label}
                      className="border-b border-slate-200 last:border-0"
                    >
                      <button
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [group.label]: !prev[group.label],
                          }))
                        }
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          {group.label}
                        </span>
                        {collapsedGroups[group.label] ? (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                      {!collapsedGroups[group.label] && (
                        <div className="pb-1">
                          {group.keys.map(({ key, label }) => {
                            const tpl = waTemplates.find(
                              (t) => t.templateKey === key,
                            );
                            const hasContent = !!(
                              tpl?.message && tpl.message.trim()
                            );
                            return (
                              <button
                                key={key}
                                onClick={() => setSelectedWaTemplate(key)}
                                className={`w-full text-left px-3 py-2.5 transition-all ${
                                  selectedWaTemplate === key
                                    ? "bg-emerald-600 text-white"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      hasContent
                                        ? "bg-emerald-400"
                                        : "bg-slate-300"
                                    } ${selectedWaTemplate === key ? "bg-white" : ""}`}
                                  />
                                  <span className="text-xs font-medium leading-tight">
                                    {label}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Custom templates */}
                  {waTemplates.filter(
                    (t) => !BUILTIN_KEYS.includes(t.templateKey),
                  ).length > 0 && (
                    <div className="border-b border-slate-200 last:border-0">
                      <div className="px-3 py-2.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          🔧 Custom Templates
                        </span>
                      </div>
                      {waTemplates
                        .filter((t) => !BUILTIN_KEYS.includes(t.templateKey))
                        .map((t) => {
                          const hasContent = !!(t.message && t.message.trim());
                          return (
                            <button
                              key={t.templateKey}
                              onClick={() =>
                                setSelectedWaTemplate(t.templateKey)
                              }
                              className={`w-full text-left px-3 py-2.5 transition-all ${
                                selectedWaTemplate === t.templateKey
                                  ? "bg-emerald-600 text-white"
                                  : "hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    hasContent
                                      ? "bg-emerald-400"
                                      : "bg-slate-300"
                                  } ${selectedWaTemplate === t.templateKey ? "bg-white" : ""}`}
                                />
                                <span className="text-xs font-medium leading-tight">
                                  {t.label || t.templateKey}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* ---- Right panel: editor ---- */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Template header */}
                  <div className="px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          {selectedMeta?.label ?? selectedWaTemplate}
                          {isCustom && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded uppercase">
                              Custom
                            </span>
                          )}
                        </h3>
                        {selectedMeta && (
                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                Sent to:
                              </span>
                              <span className="text-[11px] text-slate-700 font-semibold">
                                {selectedMeta.to}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                When:
                              </span>
                              <span className="text-[11px] text-slate-700">
                                {selectedMeta.when}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={() => {
                            const defaultMsg =
                              DEFAULT_WA_MESSAGES[selectedWaTemplate] || "";
                            const key = selectedWaTemplate;
                            setWaTemplates((prev) => {
                              const next = prev.map((t) =>
                                t.templateKey === key
                                  ? { ...t, message: defaultMsg }
                                  : t,
                              );
                              if (!next.find((t) => t.templateKey === key))
                                next.push({
                                  templateKey: key,
                                  message: defaultMsg,
                                });
                              return next;
                            });
                          }}
                          variant="ghost"
                          className="h-8 px-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Load Default
                        </Button>
                        {isCustom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDeleteTemplate(selectedWaTemplate)
                            }
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                            title="Delete Custom Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Trigger Keywords{" "}
                        <span className="text-slate-400 font-normal">
                          (comma-separated, mainly for command templates)
                        </span>
                      </Label>
                      <div className="group relative">
                        <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                          Words that trigger this template when a user types
                          them. Used mainly for chatbot command responses (stop,
                          restart, menu, back).
                        </div>
                      </div>
                    </div>
                    <Input
                      placeholder="e.g. stop, quit, exit..."
                      value={(
                        waTemplates.find(
                          (t) => t.templateKey === selectedWaTemplate,
                        )?.keywords || []
                      ).join(", ")}
                      onChange={(e) => {
                        const key = selectedWaTemplate;
                        const val = e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter((k) => k);
                        setWaTemplates((prev) => {
                          const next = prev.map((t) =>
                            t.templateKey === key ? { ...t, keywords: val } : t,
                          );
                          if (!next.find((t) => t.templateKey === key))
                            next.push({
                              templateKey: key,
                              message: "",
                              keywords: val,
                            });
                          return next;
                        });
                      }}
                      className="h-8 text-xs border-slate-200 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Message editor */}
                  <div className="flex-1 px-6 pt-3 pb-3 flex flex-col gap-3 overflow-y-auto bg-slate-950/[0.02]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Message Body{" "}
                        <span className="text-slate-400 font-normal text-[10px]">
                          — leave empty to use system default
                        </span>
                      </Label>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {(selectedTemplate?.message || "").length} / 1024
                      </span>
                    </div>

                    <textarea
                      rows={18}
                      placeholder={
                        DEFAULT_WA_MESSAGES[selectedWaTemplate]
                          ? 'Click "Load Default" to start from the system template...'
                          : "Enter your custom WhatsApp notification message. Use placeholders below to inject dynamic data."
                      }
                      value={selectedTemplate?.message ?? ""}
                      onChange={(e) => {
                        const key = selectedWaTemplate;
                        setWaTemplates((prev) => {
                          const next = prev.map((t) =>
                            t.templateKey === key
                              ? { ...t, message: e.target.value }
                              : t,
                          );
                          if (!next.find((t) => t.templateKey === key))
                            next.push({
                              templateKey: key,
                              message: e.target.value,
                            });
                          return next;
                        });
                      }}
                      className="flex w-full rounded-lg border border-slate-200 bg-slate-950 text-emerald-300 font-medium px-4 py-5 text-sm font-mono leading-relaxed resize-y focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-600"
                      spellCheck={false}
                    />

                    {/* Placeholder chips */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                        Click to insert placeholder — hover for description
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {WA_PLACEHOLDERS.map(({ ph, desc }) => (
                          <button
                            key={ph}
                            title={desc}
                            onClick={() => {
                              const key = selectedWaTemplate;
                              setWaTemplates((prev) => {
                                const current =
                                  prev.find((t) => t.templateKey === key)
                                    ?.message || "";
                                const next = prev.map((t) =>
                                  t.templateKey === key
                                    ? { ...t, message: current + ph }
                                    : t,
                                );
                                if (!next.find((t) => t.templateKey === key))
                                  next.push({ templateKey: key, message: ph });
                                return next;
                              });
                            }}
                            className="px-2 py-1 text-[11px] bg-white border border-emerald-200 text-emerald-700 rounded font-mono hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                          >
                            {ph}
                          </button>
                        ))}
                      </div>

                      {/* Highlight key placeholders */}
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <p className="text-[10px] font-bold text-amber-700 mb-1">
                            🏢 Sub-Department
                          </p>
                          <code className="text-[11px] font-mono text-amber-900">
                            {"{subDepartmentName}"}
                          </code>
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            Sub-department name (e.g. Revenue Section, Land
                            Records). Shows actual sub-department from
                            submission.
                          </p>
                        </div>
                        <div className="bg-violet-50 border border-violet-200 rounded-lg p-2">
                          <p className="text-[10px] font-bold text-violet-700 mb-1">
                            ⏱️ Resolution Time
                          </p>
                          <code className="text-[11px] font-mono text-violet-900">
                            {"{resolutionTimeText}"}
                          </code>
                          <p className="text-[10px] text-violet-600 mt-0.5">
                            Exact time taken to resolve (e.g. &quot;2 days and 3
                            hours&quot;). Auto-calculated from submission to
                            resolution time.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Save button */}
                    <div className="flex justify-between items-center pt-1">
                      <p className="text-xs text-slate-400">
                        💡 Templates are saved per-company. Changes take effect
                        immediately on the next notification.
                      </p>
                      <Button
                        onClick={handleSaveWhatsAppTemplates}
                        disabled={savingTemplates}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-9 text-[11px] font-bold uppercase tracking-wider px-6 border-0 shadow-lg shadow-emerald-900/20 shrink-0"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {savingTemplates ? "Saving..." : "Save All Templates"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
