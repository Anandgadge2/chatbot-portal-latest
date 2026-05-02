"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
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
  { key: "grievance_created", label: "Grievance Received (Admin/Hierarchy)" },
  { key: "grievance_assigned", label: "Grievance Assigned (Admin/Hierarchy)" },
  { key: "grievance_resolved", label: "Grievance Resolved (Admin/Hierarchy)" },
  { key: "appointment_created", label: "Appointment Received (Admin/Hierarchy)" },
  { key: "appointment_assigned", label: "Appointment Assigned (Admin/Hierarchy)" },
  { key: "appointment_scheduled", label: "Appointment Scheduled (Citizen)" },
  { key: "appointment_confirmed", label: "Appointment Confirmed (Citizen)" },
  { key: "appointment_cancelled", label: "Appointment Cancelled (Citizen)" },
  { key: "appointment_completed", label: "Appointment Completed (Citizen)" },
];

const DEFAULT_EMAIL_CONTENT: Record<string, { subject: string; htmlBody: string }> = {
  grievance_created: {
    subject: "🏛️ Grievance [{grievanceId}] Received | {companyName}",
    htmlBody: `
      <h2>Grievance Received</h2>
      <p>Hello Admin,</p>
      <p>A new grievance has been submitted.</p>
      <p><strong>ID:</strong> {grievanceId}</p>
      <p><strong>Citizen:</strong> {citizenName}</p>
      <p><strong>Description:</strong> {description}</p>
    `,
  },
  grievance_assigned: {
    subject: "📥 Grievance [{grievanceId}] Assigned to You",
    htmlBody: `
      <h2>Grievance Assignment</h2>
      <p>Hello {recipientName},</p>
      <p>A grievance has been assigned to your department: {departmentName}.</p>
      <p><strong>ID:</strong> {grievanceId}</p>
      <p><strong>Description:</strong> {description}</p>
    `,
  },
  grievance_resolved: {
    subject: "✅ Grievance [{grievanceId}] Resolved Successfully",
    htmlBody: `
      <h2>Grievance Resolved</h2>
      <p>Hello,</p>
      <p>The following grievance has been marked as resolved.</p>
      <p><strong>ID:</strong> {grievanceId}</p>
      <p><strong>Resolved By:</strong> {resolvedByName}</p>
      <p><strong>Remarks:</strong> {remarks}</p>
    `,
  },
  appointment_created: {
    subject: "🗓️ New Appointment Request [{appointmentId}]",
    htmlBody: `
      <h2>New Appointment</h2>
      <p>Hello Admin,</p>
      <p>A citizen has requested an appointment.</p>
      <p><strong>ID:</strong> {appointmentId}</p>
      <p><strong>Citizen:</strong> {citizenName}</p>
      <p><strong>Purpose:</strong> {purpose}</p>
    `,
  },
  appointment_assigned: {
    subject: "🔔 Appointment [{appointmentId}] Assigned to You",
    htmlBody: `
      <h2>Appointment Assignment</h2>
      <p>Hello {recipientName},</p>
      <p>An appointment request has been assigned to you.</p>
      <p><strong>ID:</strong> {appointmentId}</p>
      <p><strong>Citizen:</strong> {citizenName}</p>
      <p><strong>Purpose:</strong> {purpose}</p>
    `,
  },
  appointment_scheduled: {
    subject: "🗓️ Appointment Scheduled: [{appointmentId}]",
    htmlBody: `
      <h2>Appointment Scheduled</h2>
      <p>Hello {citizenName},</p>
      <p>Your appointment has been scheduled for {formattedDate}.</p>
      <p><strong>ID:</strong> {appointmentId}</p>
      <p><strong>Matrix Node:</strong> {companyName}</p>
    `,
  },
  appointment_confirmed: {
    subject: "✔️ Appointment Confirmed: [{appointmentId}]",
    htmlBody: `
      <h2>Appointment Confirmed</h2>
      <p>Hello {citizenName},</p>
      <p>Your appointment on {formattedDate} has been confirmed.</p>
      <p><strong>ID:</strong> {appointmentId}</p>
      <p><strong>Status:</strong> Active</p>
    `,
  },
  appointment_cancelled: {
    subject: "❌ Appointment Cancelled: [{appointmentId}]",
    htmlBody: `
      <h2>Appointment Cancelled</h2>
      <p>Hello {citizenName},</p>
      <p>We regret to inform you that your appointment ({appointmentId}) has been cancelled.</p>
      <p>Please contact {companyName} for further assistance.</p>
    `,
  },
  appointment_completed: {
    subject: "🎉 Appointment Completed: [{appointmentId}]",
    htmlBody: `
      <h2>Appointment Completed</h2>
      <p>Hello {citizenName},</p>
      <p>Your appointment ({appointmentId}) has been marked as completed.</p>
      <p>Thank you for using our services.</p>
    `,
  },
};

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

export interface EmailConfigTabProps {
  companyId: string;
}

export default function EmailConfigTab({ companyId }: EmailConfigTabProps) {
  const { user } = useAuth();
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [companyRes, configRes, templatesRes] = await Promise.all([
        apiClient.get(`/companies/${companyId}`),
        apiClient
          .get(`/email-config/company/${companyId}`)
          .catch(() => ({ success: false })),
        apiClient
          .get(`/email-config/company/${companyId}/templates`)
          .catch(() => ({ success: false })),
      ]);

      // Process Company
      const co = companyRes.data?.company || companyRes.data;
      if (co) setCompany(co);

      // Process Config
      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
        setIsEditing(false);
      } else {
        initEmptyConfig(co?.name);
      }

      // Process Templates
      const tl = templatesRes.success ? templatesRes.data : (templatesRes?.data || []);
      const merged = TEMPLATE_KEYS.map((t: { key: string; label: string }) => {
        const existing = Array.isArray(tl) ? tl.find((item: any) => item.templateKey === t.key) : null;
        if (existing) return existing;
        return {
          templateKey: t.key,
          subject: DEFAULT_EMAIL_CONTENT[t.key]?.subject || "",
          htmlBody: DEFAULT_EMAIL_CONTENT[t.key]?.htmlBody || "",
        };
      });
      setTemplates(merged);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load data");
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
      // Fallback
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
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner text="Retrieving matrix configuration..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
           <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">SMTP Relay Matrix</h2>
           <p className="text-[14px] text-slate-500 font-medium italic">Config: <span className="text-indigo-600">{company?.name}</span></p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            {config?._id && (
              <>
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  variant="outline"
                  className="h-8 px-3 text-[14px] font-bold uppercase rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {testing ? "Verifying..." : "Test SMTP"}
                </Button>
                <Button
                  onClick={() => setShowTestInput((v) => !v)}
                  variant="outline"
                  className="h-8 px-3 text-[14px] font-bold uppercase rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send Test
                </Button>
              </>
            )}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 px-4 text-[14px] font-bold uppercase"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "Deploying..." : "Save Config"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="h-8 text-[14px]"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg h-8 px-4 text-[14px] font-bold uppercase"
              >
                Modify Config
              </Button>
            )}
        </div>
      </div>

      {showTestInput && (
        <Card className="bg-emerald-50 border-emerald-200 animate-in slide-in-from-top-2">
           <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 space-y-1">
                 <Label className="text-[14px] font-bold text-emerald-800 uppercase">Test Recipient Email</Label>
                 <Input 
                   type="email" 
                   value={testEmailAddr} 
                   onChange={(e) => setTestEmailAddr(e.target.value)}
                   placeholder="alert-manager@example.com"
                   className="h-9 text-xs border-emerald-300"
                 />
              </div>
              <Button onClick={handleSendTestEmail} disabled={sendingTest} className="h-9 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs">
                 {sendingTest ? "Sending..." : "Send Test Flow"}
              </Button>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* SMTP Infrastructure Card */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
             <CardHeader className="bg-slate-900 py-3 border-b border-slate-800">
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    Infrastructure Parameters
                </CardTitle>
             </CardHeader>
             <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">SMTP Host</Label>
                        <Input value={config?.host || ""} onChange={(e) => updateConfig("host", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">Port (465/587)</Label>
                        <Input type="number" value={config?.port ?? 465} onChange={(e) => updateConfig("port", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">SMTP User</Label>
                        <Input value={config?.auth?.user || ""} onChange={(e) => updateConfig("auth.user", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">SMTP Password</Label>
                        <Input type="password" value={config?.auth?.pass || ""} onChange={(e) => updateConfig("auth.pass", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">From Email</Label>
                        <Input value={config?.fromEmail || ""} onChange={(e) => updateConfig("fromEmail", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-500">Sender Name</Label>
                        <Input value={config?.fromName || ""} onChange={(e) => updateConfig("fromName", e.target.value)} disabled={!isEditing} className="h-9 text-xs" />
                    </div>
                </div>
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-50">
                   <Switch id="active-mail" checked={config?.isActive !== false} onCheckedChange={(v) => updateConfig("isActive", v)} disabled={!isEditing}/>
                   <Label htmlFor="active-mail" className="text-[15px] font-medium">Activate Mail Matrix Node</Label>
                </div>
             </CardContent>
          </Card>

          {/* Template Logic Card */}
          <Card className="rounded-xl border-slate-200 shadow-sm flex flex-col h-full">
            <CardHeader className="bg-slate-900 py-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    Payload Templates
                </CardTitle>
                <Button onClick={handleSaveTemplates} disabled={savingTemplates} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-[15px] uppercase font-black px-3">
                   {savingTemplates ? "Syncing..." : "Sync Templates"}
                </Button>
             </CardHeader>
             <CardContent className="p-5 flex-1 flex flex-col space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                        <Label className="text-[15px] font-black uppercase text-slate-400">Select Event Node</Label>
                        <select
                            value={selectedTemplateKey}
                            onChange={(e) => setSelectedTemplateKey(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                            {TEMPLATE_KEYS.map((t) => (
                                <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={handleLoadDefault} variant="ghost" className="h-9 rounded-lg border border-slate-100 mt-5 text-[14px] font-bold text-indigo-600">
                        <RotateCcw className="w-3 h-3 mr-1.5" /> Reset Default
                    </Button>
                </div>

                <div className="space-y-1">
                    <Label className="text-[15px] font-black uppercase text-slate-400">Subject</Label>
                    <Input value={selectedTemplate?.subject || ""} onChange={(e) => updateTemplateField("subject", e.target.value)} placeholder="e.g. {companyName} Alert" className="h-9 text-xs font-mono font-bold" />
                </div>

                <div className="flex-1 flex flex-col space-y-2">
                   <div className="flex items-center justify-between">
                      <Label className="text-[15px] font-black uppercase text-slate-400">Payload HTML</Label>
                      <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                         <button onClick={() => setEditorTab("code")} className={`px-3 py-1 text-[15px] font-black uppercase rounded-md transition-all ${editorTab === "code" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-white/50 text-slate-500"}`}>Code</button>
                         <button onClick={() => setEditorTab("preview")} className={`px-3 py-1 text-[15px] font-black uppercase rounded-md transition-all ${editorTab === "preview" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-white/50 text-slate-500"}`}>Eye</button>
                      </div>
                   </div>

                   {editorTab === "code" ? (
                      <textarea
                        id="htmlBodyEditor"
                        value={selectedTemplate?.htmlBody || ""}
                        onChange={(e) => updateTemplateField("htmlBody", e.target.value)}
                        className="flex-1 w-full min-h-[500px] rounded-xl border border-slate-200 bg-slate-950 text-green-400 p-4 font-mono text-xs leading-relaxed resize-none outline-none focus:ring-1 focus:ring-indigo-500"
                        spellCheck={false}
                      />
                   ) : (
                      <div className="flex-1 w-full min-h-[500px] rounded-xl border border-slate-200 bg-white overflow-hidden">
                         <iframe srcDoc={selectedTemplate.htmlBody} className="w-full h-full min-h-[500px]" title="EML Preview" sandbox="allow-same-origin"/>
                      </div>
                   )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                   <p className="text-[15px] font-black text-slate-400 uppercase mb-2">Matrix Placeholders</p>
                   <div className="flex flex-wrap gap-1.5">
                      {PLACEHOLDERS.map(ph => (
                         <button key={ph} onClick={() => insertPlaceholder(ph)} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[14px] font-mono font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-700 transition-all">{ph}</button>
                      ))}
                   </div>
                </div>
             </CardContent>
          </Card>
      </div>
    </div>
  );
}
