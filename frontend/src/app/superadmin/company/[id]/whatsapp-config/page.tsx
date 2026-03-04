"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  Phone,
  Shield,
  MessageSquare,
  Clock,
  Globe,
  FileText,
  RotateCcw,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  getPhoneNumberFormats,
  isValidPhoneNumber,
} from "@/lib/utils/phoneNumber";

const WHATSAPP_TEMPLATE_KEYS = [
  { key: "grievance_created", label: "Grievance Created (to dept admin)" },
  { key: "grievance_assigned", label: "Grievance Assigned (to assigned user)" },
  {
    key: "grievance_resolved",
    label: "Grievance Resolved (citizen + hierarchy)",
  },
  { key: "appointment_created", label: "Appointment Created (to admin)" },
  {
    key: "appointment_assigned",
    label: "Appointment Assigned (to assigned user)",
  },
  {
    key: "appointment_resolved",
    label: "Appointment Resolved (citizen + hierarchy)",
  },
];
const WA_PLACEHOLDERS = [
  "{companyName}",
  "{recipientName}",
  "{citizenName}",
  "{citizenPhone}",
  "{grievanceId}",
  "{appointmentId}",
  "{departmentName}",
  "{description}",
  "{purpose}",
  "{assignedByName}",
  "{formattedDate}",
  "{resolvedByName}",
  "{remarks}",
  "{oldStatus}",
  "{newStatus}",
];

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

Respected {recipientName},

🎫 *Reference ID:* {grievanceId}
🏢 *Department:* {departmentName}
📊 *Status:* RESOLVED
👨‍💼 *Resolved By:* {resolvedByName}
📅 *Resolved On:* {formattedDate}

📝 *Remarks:* {remarks}

Thank you for your patience.

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

Respected {recipientName},

🎫 *Reference ID:* {appointmentId}
📊 *Status:* COMPLETED
👨‍💼 *Completed By:* {resolvedByName}
📅 *Completed On:* {formattedDate}

📝 *Remarks:* {remarks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*{companyName}*
Digital Appointment System`,
};

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
  const [waTemplates, setWaTemplates] = useState<
    Array<{ templateKey: string; message?: string }>
  >([]);
  const [selectedWaTemplate, setSelectedWaTemplate] =
    useState<string>("grievance_created");
  const [savingTemplates, setSavingTemplates] = useState(false);

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") {
      router.push("/superadmin/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when companyId/role change only
  }, [companyId, user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch company
      const companyRes = await apiClient.get(`/companies/${companyId}`);
      if (companyRes.success && companyRes.data?.company) {
        setCompany(companyRes.data.company);
      } else if (companyRes.data?.company) {
        setCompany(companyRes.data.company);
      }

      // Fetch WhatsApp config
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
          setConfig({
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
          });
          setIsEditing(true); // Start in edit mode for new config
        }
      } catch (configError: any) {
        // If 404, initialize empty config (first time setup)
        if (
          configError.response?.status === 404 ||
          configError.response?.status === 400
        ) {
          setConfig({
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
          });
          setIsEditing(true);
        } else {
          console.error("❌ Error loading config:", configError);
          throw configError;
        }
      }

      try {
        const templatesRes = await apiClient.get<{
          success?: boolean;
          data?: Array<{ templateKey: string; message?: string }>;
        }>(`/whatsapp-config/company/${companyId}/templates`);
        const list = (templatesRes as any)?.data ?? (templatesRes as any);
        if (Array.isArray(list) && list.length > 0) {
          setWaTemplates(list);
        } else {
          setWaTemplates(
            WHATSAPP_TEMPLATE_KEYS.map((t) => ({ templateKey: t.key })),
          );
        }
      } catch (_) {
        setWaTemplates(
          WHATSAPP_TEMPLATE_KEYS.map((t) => ({ templateKey: t.key })),
        );
      }
    } catch (error: any) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsAppTemplates = async () => {
    try {
      setSavingTemplates(true);
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates
          .filter((t) => t.templateKey)
          .map((t) => ({
            templateKey: t.templateKey,
            message: t.message ?? "",
          })),
      });
      toast.success("WhatsApp templates saved");
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Failed to save WhatsApp templates",
      );
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let existingConfigId = config._id;
      if (!existingConfigId) {
        try {
          const existingRes = await apiClient.get(
            `/whatsapp-config/company/${companyId}`,
          );
          if (existingRes.success && existingRes.data?._id) {
            existingConfigId = existingRes.data._id;
          } else if (existingRes.data?._id) {
            existingConfigId = existingRes.data._id;
          }
        } catch (_) {}
      }
      const url = existingConfigId
        ? `/whatsapp-config/${existingConfigId}`
        : "/whatsapp-config";
      const method = existingConfigId ? "put" : "post";
      const res = await apiClient[method](url, config);

      // apiClient methods return response.data directly
      if (res?.success === true) {
        toast.success(
          res.message || "WhatsApp configuration saved successfully",
        );
        setIsEditing(false);
        fetchData(); // Reload to get the updated config with _id
      } else if (res?.data) {
        toast.success("WhatsApp configuration saved successfully");
        setIsEditing(false);
        fetchData();
      } else {
        // Handle error response from backend
        const errorMessage = res?.message || "Failed to save configuration";
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("❌ Save error:", error);

      // Extract error message from various possible locations
      let errorMessage = "Failed to save configuration";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Handle specific error cases
      if (error.response?.status === 400) {
        // Bad Request - validation errors
        if (errorMessage.includes("already used by another company")) {
          toast.error(
            `❌ ${errorMessage}\n\nPlease use a different Phone Number ID or deactivate the other configuration.`,
          );
        } else if (errorMessage.includes("already exists")) {
          // Try to update instead
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
                toast.success("WhatsApp configuration updated successfully");
                setIsEditing(false);
                fetchData();
                return;
              } else {
                toast.error(
                  updateRes?.message || "Failed to update configuration",
                );
              }
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
      } else if (error.response?.status === 409) {
        // Conflict
        toast.error(`❌ Conflict: ${errorMessage}`);
      } else if (error.response?.status === 500) {
        // Server error
        toast.error("❌ Server error. Please try again or contact support.");
      } else {
        // Generic error
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header with Dark Slate Theme */}
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
          {/* WhatsApp Business API Credentials */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-400" />
                Cloud API Infrastructure credentials
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Meta Business Suite Connectivity
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      // Update display and API format automatically
                      updateConfig("displayPhoneNumber", formats.displayFormat);
                      updateConfig("phoneNumber", formats.apiFormat);
                    }}
                    onBlur={(e) => {
                      // Validate on blur
                      const input = e.target.value;
                      if (input && !isValidPhoneNumber(input)) {
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
                  <p className="text-xs text-gray-500 mt-2">
                    💡 <strong>Tip:</strong> Enter your WhatsApp number with
                    country code. For India:{" "}
                    <code className="bg-gray-100 px-1 rounded">
                      +91 XXXXX XXXXX
                    </code>
                    , For US (test):{" "}
                    <code className="bg-gray-100 px-1 rounded">
                      +1 555 XXX XXXX
                    </code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="phoneNumberId"
                    className="text-sm font-semibold"
                  >
                    Phone Number ID
                  </Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="From Meta Business Manager (e.g., 957847664885159)"
                    value={config?.phoneNumberId || ""}
                    onChange={(e) =>
                      updateConfig("phoneNumberId", e.target.value)
                    }
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    This is the unique Phone Number ID from Meta Business
                    Manager, different from the phone number itself.
                  </p>
                </div>

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

          {/* Chatbot Settings */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                Automated Response Intelligence
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Chatbot behavioral configurations
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="chatbotEnabled"
                    checked={config?.chatbotSettings?.isEnabled || false}
                    onCheckedChange={(checked) =>
                      updateConfig("chatbotSettings.isEnabled", checked)
                    }
                    disabled={!isEditing}
                  />
                  <Label htmlFor="chatbotEnabled">Enable Chatbot</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultLanguage">Default Language</Label>
                  <select
                    id="defaultLanguage"
                    value={config?.chatbotSettings?.defaultLanguage || "en"}
                    onChange={(e) =>
                      updateConfig(
                        "chatbotSettings.defaultLanguage",
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <textarea
                    id="welcomeMessage"
                    rows={3}
                    placeholder="Enter welcome message..."
                    value={config?.chatbotSettings?.welcomeMessage || ""}
                    onChange={(e) =>
                      updateConfig(
                        "chatbotSettings.welcomeMessage",
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Message Templates */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Dynamic Message Templates
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Custom notification schemas for automated alerts
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template selector + load default */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-semibold">Template</Label>
                  <select
                    value={selectedWaTemplate}
                    onChange={(e) => setSelectedWaTemplate(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {WHATSAPP_TEMPLATE_KEYS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
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
                        next.push({ templateKey: key, message: defaultMsg });
                      return next;
                    });
                  }}
                  variant="ghost"
                  className="h-10 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold text-xs gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Load System Default
                </Button>
              </div>

              {/* Message editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Message (leave empty for default)
                  </Label>
                  <span className="text-xs text-slate-400">
                    {
                      (
                        waTemplates.find(
                          (t) => t.templateKey === selectedWaTemplate,
                        )?.message || ""
                      ).length
                    }{" "}
                    chars
                  </span>
                </div>
                <textarea
                  rows={14}
                  placeholder={
                    DEFAULT_WA_MESSAGES[selectedWaTemplate]
                      ? 'Click "Load System Default" to start from the system template...'
                      : "Enter your custom WhatsApp message..."
                  }
                  value={
                    waTemplates.find(
                      (t) => t.templateKey === selectedWaTemplate,
                    )?.message ?? ""
                  }
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
                  className="flex w-full rounded-lg border border-input bg-slate-950 text-green-300 px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500"
                  spellCheck={false}
                />
              </div>

              {/* Placeholder chips */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  Click to insert placeholder
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WA_PLACEHOLDERS.map((ph) => (
                    <button
                      key={ph}
                      onClick={() => {
                        const key = selectedWaTemplate;
                        setWaTemplates((prev) => {
                          const current =
                            prev.find((t) => t.templateKey === key)?.message ||
                            "";
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
                      className="px-2 py-1 text-xs bg-white border border-emerald-200 text-emerald-700 rounded font-mono hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  Leave empty to use the system default message for this event.
                </p>
                <Button
                  onClick={handleSaveWhatsAppTemplates}
                  disabled={savingTemplates}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-9 text-[11px] font-bold uppercase tracking-wider px-6 border-0 shadow-lg shadow-emerald-900/20"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingTemplates ? "Saving..." : "Commit Templates"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Transmission Rate Controls
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Traffic shaping and message frequency limits
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="perMinute">Messages Per Minute</Label>
                  <Input
                    id="perMinute"
                    type="number"
                    value={config?.rateLimits?.messagesPerMinute || 60}
                    onChange={(e) =>
                      updateConfig(
                        "rateLimits.messagesPerMinute",
                        parseInt(e.target.value),
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perHour">Messages Per Hour</Label>
                  <Input
                    id="perHour"
                    type="number"
                    value={config?.rateLimits?.messagesPerHour || 1000}
                    onChange={(e) =>
                      updateConfig(
                        "rateLimits.messagesPerHour",
                        parseInt(e.target.value),
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perDay">Messages Per Day</Label>
                  <Input
                    id="perDay"
                    type="number"
                    value={config?.rateLimits?.messagesPerDay || 10000}
                    onChange={(e) =>
                      updateConfig(
                        "rateLimits.messagesPerDay",
                        parseInt(e.target.value),
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {config?._id && (
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  Operational Telemetry
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Real-time usage and throughput metrics
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Messages Sent
                    </p>
                    <p className="text-2xl font-bold">
                      {config.stats?.totalMessagesSent || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Messages Received
                    </p>
                    <p className="text-2xl font-bold">
                      {config.stats?.totalMessagesReceived || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Conversations
                    </p>
                    <p className="text-2xl font-bold">
                      {config.stats?.totalConversations || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Last Message
                    </p>
                    <p className="text-sm font-medium">
                      {config.stats?.lastMessageAt
                        ? new Date(
                            config.stats.lastMessageAt,
                          ).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
