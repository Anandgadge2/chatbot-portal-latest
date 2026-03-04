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
  Mail,
  Shield,
  CheckCircle,
  Eye,
  Code,
  RotateCcw,
  Send,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const TEMPLATE_KEYS = [
  { key: "grievance_created", label: "Grievance – New (to dept admin)" },
  { key: "grievance_assigned", label: "Grievance – Assigned to you" },
  { key: "grievance_resolved", label: "Grievance – Resolved" },
  { key: "appointment_created", label: "Appointment – New" },
  { key: "appointment_assigned", label: "Appointment – Assigned to you" },
  { key: "appointment_resolved", label: "Appointment – Resolved" },
];

const PLACEHOLDERS = [
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
  "{createdAt}",
  "{assignedAt}",
  "{resolvedAt}",
];

export default function EmailConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [templates, setTemplates] = useState<
    Array<{ templateKey: string; subject?: string; htmlBody?: string }>
  >([]);
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<string>("grievance_created");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [editorTab, setEditorTab] = useState<"code" | "preview">("code");
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);

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
      const co = companyRes.data?.company || companyRes.data;
      if (co) setCompany(co);

      try {
        const configRes = await apiClient.get(
          `/email-config/company/${companyId}`,
        );
        if (configRes.success && configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else {
          initEmptyConfig(co?.name);
        }
      } catch (err: any) {
        if (err.response?.status === 404) initEmptyConfig(co?.name);
        else throw err;
      }

      try {
        const templatesRes = await apiClient.get(
          `/email-config/company/${companyId}/templates`,
        );
        if (templatesRes.success && Array.isArray(templatesRes.data)) {
          setTemplates(templatesRes.data);
        } else {
          setTemplates(TEMPLATE_KEYS.map((t) => ({ templateKey: t.key })));
        }
      } catch (_) {
        setTemplates(TEMPLATE_KEYS.map((t) => ({ templateKey: t.key })));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load data");
      router.push(`/superadmin/company/${companyId}`);
    } finally {
      setLoading(false);
    }
  };

  const initEmptyConfig = (companyName?: string) => {
    setConfig({
      companyId,
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "", pass: "" },
      fromEmail: "",
      fromName: companyName || "Dashboard Notifications",
      isActive: true,
    });
    setIsEditing(true);
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const next = { ...prev };
      if (path === "auth.user") next.auth = { ...next.auth, user: value };
      else if (path === "auth.pass") next.auth = { ...next.auth, pass: value };
      else next[path] = value;
      return next;
    });
  };

  const handleSave = async () => {
    if (
      !config?.host ||
      !config?.auth?.user ||
      !config?.auth?.pass ||
      !config?.fromEmail ||
      !config?.fromName
    ) {
      toast.error(
        "Host, SMTP user, password, from email and from name are required",
      );
      return;
    }
    setSaving(true);
    try {
      const portNum = Number(config.port) || 465;
      const payload = {
        companyId,
        host: config.host,
        port: portNum,
        secure: portNum === 465,
        auth: { user: config.auth?.user, pass: config.auth?.pass },
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        isActive: config.isActive !== false,
      };
      const existingRes = await apiClient
        .get(`/email-config/company/${companyId}`)
        .catch(() => null);
      if (existingRes?.success && existingRes.data?._id) {
        await apiClient.put(`/email-config/${existingRes.data._id}`, payload);
        toast.success("Email configuration updated");
      } else {
        await apiClient.post("/email-config", payload);
        toast.success("Email configuration created");
      }
      setIsEditing(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const portNum = Number(config.port) || 465;
      await apiClient.post(`/email-config/company/${companyId}/test`, {
        host: config.host,
        port: portNum,
        secure: portNum === 465,
        auth: config.auth,
        fromEmail: config.fromEmail,
      });
      toast.success("✅ SMTP connection successful! Credentials are valid.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "SMTP test failed",
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddr || !testEmailAddr.includes("@")) {
      toast.error("Please enter a valid test email address");
      return;
    }
    setSendingTest(true);
    try {
      await apiClient.post(`/email-config/company/${companyId}/send-test`, {
        to: testEmailAddr,
      });
      toast.success(`Test email sent to ${testEmailAddr}`);
      setShowTestInput(false);
      setTestEmailAddr("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  // Template editing helpers
  const selectedTemplate = templates.find(
    (t) => t.templateKey === selectedTemplateKey,
  ) || { templateKey: selectedTemplateKey, subject: "", htmlBody: "" };

  const updateTemplateField = (
    field: "subject" | "htmlBody",
    value: string,
  ) => {
    setTemplates((prev) => {
      const found = prev.some((t) => t.templateKey === selectedTemplateKey);
      if (found)
        return prev.map((t) =>
          t.templateKey === selectedTemplateKey ? { ...t, [field]: value } : t,
        );
      return [...prev, { templateKey: selectedTemplateKey, [field]: value }];
    });
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await apiClient.put(`/email-config/company/${companyId}/templates`, {
        templates: templates
          .filter((t) => t.subject || t.htmlBody)
          .map((t) => ({
            templateKey: t.templateKey,
            subject: t.subject || "",
            htmlBody: t.htmlBody || "",
          })),
      });
      toast.success("Email templates saved");
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleLoadDefault = async () => {
    try {
      const res = await apiClient.get(
        `/email-config/default-template?type=${selectedTemplateKey}`,
      );
      if (res.success && res.data) {
        updateTemplateField("subject", res.data.subject || "");
        updateTemplateField("htmlBody", res.data.html || "");
        toast.success("Default template loaded into editor");
      } else {
        toast.error("Could not load default template");
      }
    } catch (_) {
      // Fallback: generate inline
      const parts = selectedTemplateKey.split("_");
      const type = parts[0] as any;
      const action = parts[1] as any;
      toast("Loading an approximation of the default template");
      updateTemplateField(
        "subject",
        `${type === "grievance" ? "Grievance" : "Appointment"} ${action} – {grievanceId || appointmentId} | {companyName}`,
      );
      updateTemplateField(
        "htmlBody",
        `<p>Dear {recipientName},</p><p>This is a notification about your ${type} (${action}).</p><p>Reference: {grievanceId}</p>`,
      );
    }
  };

  const insertPlaceholder = (ph: string) => {
    const ta = document.getElementById(
      "htmlBodyEditor",
    ) as HTMLTextAreaElement | null;
    if (!ta) {
      updateTemplateField("htmlBody", (selectedTemplate?.htmlBody || "") + ph);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = selectedTemplate?.htmlBody || "";
    const next = current.substring(0, start) + ph + current.substring(end);
    updateTemplateField("htmlBody", next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + ph.length, start + ph.length);
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                  SMTP Relay Matrix
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Mailing Node:{" "}
                    <span className="text-indigo-400">{company?.name}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {config?._id && (
                <>
                  <Button
                    onClick={handleTest}
                    disabled={testing}
                    variant="ghost"
                    className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 font-bold text-[11px] uppercase tracking-wider"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {testing ? "Verifying..." : "Test Connection"}
                  </Button>
                  <Button
                    onClick={() => setShowTestInput((v) => !v)}
                    variant="ghost"
                    className="h-10 px-4 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-xl transition-all border border-emerald-600/30 font-bold text-[11px] uppercase tracking-wider"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </Button>
                </>
              )}
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

      <main className="max-w-[1600px] mx-auto w-full px-4 py-6 space-y-6">
        {/* Send Test Email Panel */}
        {showTestInput && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-emerald-800 mb-1 block">
                Send a test email to verify SMTP is working
              </Label>
              <Input
                placeholder="your@email.com"
                value={testEmailAddr}
                onChange={(e) => setTestEmailAddr(e.target.value)}
                className="border-emerald-300 focus:ring-emerald-500"
                type="email"
              />
            </div>
            <div className="flex gap-2 pt-5">
              <Button
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendingTest ? "Sending..." : "Send"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowTestInput(false)}
                className="text-slate-500"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* SMTP Settings */}
        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              SMTP Relay Infrastructure Settings
            </CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Custom Outbound Mailing Services
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host *</Label>
                <Input
                  id="host"
                  placeholder="smtp.gmail.com"
                  value={config?.host || ""}
                  onChange={(e) => updateConfig("host", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="465"
                  value={config?.port ?? 465}
                  onChange={(e) => updateConfig("port", e.target.value)}
                  disabled={!isEditing}
                />
                <p className="text-xs text-muted-foreground">
                  465 (SSL) or 587 (STARTTLS)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth.user">SMTP User (email) *</Label>
                <Input
                  id="auth.user"
                  type="email"
                  placeholder="noreply@example.com"
                  value={config?.auth?.user || ""}
                  onChange={(e) => updateConfig("auth.user", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth.pass">SMTP Password *</Label>
                <Input
                  id="auth.pass"
                  type="password"
                  placeholder="••••••••"
                  value={config?.auth?.pass || ""}
                  onChange={(e) => updateConfig("auth.pass", e.target.value)}
                  disabled={!isEditing}
                />
                {config?.auth?.pass && !isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Password is hidden
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email *</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  placeholder="noreply@company.com"
                  value={config?.fromEmail || ""}
                  onChange={(e) => updateConfig("fromEmail", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name *</Label>
                <Input
                  id="fromName"
                  placeholder="Collectorate Jharsuguda"
                  value={config?.fromName || ""}
                  onChange={(e) => updateConfig("fromName", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="isActive"
                  checked={config?.isActive !== false}
                  onCheckedChange={(checked) =>
                    updateConfig("isActive", checked)
                  }
                  disabled={!isEditing}
                />
                <Label htmlFor="isActive">
                  Active (use this config for sending)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Template Editor */}
        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Mailing Payload Templates
            </CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Customize email subject and HTML content for each notification
              event
            </p>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {/* Template selector + actions */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-semibold">Template</Label>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => {
                    setSelectedTemplateKey(e.target.value);
                    setEditorTab("code");
                  }}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {TEMPLATE_KEYS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleLoadDefault}
                variant="ghost"
                className="h-10 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold text-xs gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Load System Default
              </Button>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Subject</Label>
              <Input
                placeholder="e.g. New Grievance - {grievanceId} | {companyName}"
                value={selectedTemplate?.subject || ""}
                onChange={(e) => updateTemplateField("subject", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* HTML editor with tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">HTML Body</Label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setEditorTab("code")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${editorTab === "code" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Code className="w-3 h-3" /> Code
                  </button>
                  <button
                    onClick={() => setEditorTab("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${editorTab === "preview" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                </div>
              </div>

              {editorTab === "code" ? (
                <textarea
                  id="htmlBodyEditor"
                  placeholder="Enter HTML content here, or click 'Load System Default' to start from the built-in template."
                  value={selectedTemplate?.htmlBody || ""}
                  onChange={(e) =>
                    updateTemplateField("htmlBody", e.target.value)
                  }
                  rows={18}
                  className="flex w-full rounded-lg border border-input bg-slate-950 text-green-300 px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-500"
                  spellCheck={false}
                />
              ) : (
                <div className="w-full rounded-lg border border-slate-200 bg-white overflow-auto min-h-[280px] max-h-[500px]">
                  {selectedTemplate?.htmlBody ? (
                    <iframe
                      srcDoc={selectedTemplate.htmlBody}
                      className="w-full min-h-[450px]"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                      No HTML content yet. Switch to Code tab and enter your
                      HTML.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Placeholder chip toolbar */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                Click to insert placeholder
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph}
                    onClick={() => insertPlaceholder(ph)}
                    className="px-2 py-1 text-xs bg-white border border-indigo-200 text-indigo-700 rounded font-mono hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <p className="text-xs text-slate-400">
                Leave Subject and HTML blank to use the system default template
                for this event.
              </p>
              <Button
                onClick={handleSaveTemplates}
                disabled={savingTemplates}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 text-[11px] font-bold uppercase tracking-wider px-6 border-0 shadow-lg shadow-indigo-900/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingTemplates ? "Saving..." : "Commit Templates"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
