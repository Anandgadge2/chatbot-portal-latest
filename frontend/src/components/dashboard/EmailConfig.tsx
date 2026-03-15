"use client";

import { useState, useEffect, useCallback } from "react";
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
  RotateCcw,
  Code,
  Eye,
  Send,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const TEMPLATE_KEYS = [
  { key: "grievance_created", label: "Grievance – New (to admins)" },
  { key: "grievance_assigned", label: "Grievance – Assigned to you" },
  { key: "grievance_resolved", label: "Grievance – Resolved" },
  { key: "appointment_created", label: "Appointment – New (to admins)" },
  { key: "appointment_assigned", label: "Appointment – Assigned to you" },
  { key: "appointment_scheduled", label: "Appointment – Scheduled" },
  { key: "appointment_confirmed", label: "Appointment – Confirmed" },
  { key: "appointment_cancelled", label: "Appointment – Cancelled" },
  { key: "appointment_completed", label: "Appointment – Resolved / Completed" },
];

const PLACEHOLDERS = [
  "{companyName}", "{recipientName}", "{citizenName}", "{citizenPhone}",
  "{grievanceId}", "{appointmentId}", "{departmentName}", "{description}",
  "{purpose}", "{assignedByName}", "{formattedDate}", "{resolvedByName}",
  "{remarks}", "{createdAt}", "{assignedAt}", "{resolvedAt}"
];

interface EmailConfigProps {
  companyId: string;
}

export default function EmailConfig({ companyId }: EmailConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("grievance_created");
  const [editorTab, setEditorTab] = useState<"code" | "preview">("code");
  const [savingTemplates, setSavingTemplates] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, templatesRes] = await Promise.all([
        apiClient.get(`/email-config/company/${companyId}`).catch(() => ({ success: false })),
        apiClient.get(`/email-config/company/${companyId}/templates`).catch(() => ({ success: false })),
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
      } else {
        setConfig({ companyId, host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "", pass: "" }, fromEmail: "", fromName: "", isActive: true });
        setIsEditing(true);
      }

      if (templatesRes.success && Array.isArray(templatesRes.data)) {
        setTemplates(templatesRes.data);
      } else {
        setTemplates(TEMPLATE_KEYS.map(t => ({ templateKey: t.key, subject: "", htmlBody: "" })));
      }
    } catch (error) {
      toast.error("Failed to load email configuration");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
       const method = config._id ? "put" : "post";
       const url = config._id ? `/email-config/${config._id}` : "/email-config";
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

  const handleTest = async () => {
    setTesting(true);
    try {
      await apiClient.post(`/email-config/company/${companyId}/test`, config);
      toast.success("SMTP connection successful!");
    } catch (error: any) {
      toast.error("SMTP test failed: " + (error.response?.data?.message || error.message));
    } finally {
      setTesting(false);
    }
  };

  const selectedTemplate = templates.find(t => t.templateKey === selectedTemplateKey) || { templateKey: selectedTemplateKey, subject: "", htmlBody: "" };

  const updateTemplateField = (field: string, value: string) => {
    setTemplates(prev => {
      const exists = prev.some(t => t.templateKey === selectedTemplateKey);
      if (exists) {
        return prev.map(t => t.templateKey === selectedTemplateKey ? { ...t, [field]: value } : t);
      }
      return [...prev, { templateKey: selectedTemplateKey, [field]: value }];
    });
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await apiClient.put(`/email-config/company/${companyId}/templates`, {
        templates: templates.filter(t => t.subject || t.htmlBody)
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
          <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            SMTP Server Configuration
          </CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button size="sm" onClick={() => setIsEditing(true)}>Modify</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-white">Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Deploy Settings"}</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="bg-white/10 text-white border-white/20">
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input value={config.host} onChange={e => setConfig({...config, host: e.target.value})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input type="number" value={config.port} onChange={e => setConfig({...config, port: parseInt(e.target.value)})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Username</Label>
            <Input value={config.auth?.user} onChange={e => setConfig({...config, auth: {...config.auth, user: e.target.value}})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Password</Label>
            <Input type="password" value={config.auth?.pass} onChange={e => setConfig({...config, auth: {...config.auth, pass: e.target.value}})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input value={config.fromEmail} onChange={e => setConfig({...config, fromEmail: e.target.value})} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input value={config.fromName} onChange={e => setConfig({...config, fromName: e.target.value})} disabled={!isEditing} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            Email Templates
          </CardTitle>
          <Button size="sm" onClick={handleSaveTemplates} disabled={savingTemplates}>{savingTemplates ? "Saving..." : "Commit Templates"}</Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
             <Label>Select Template</Label>
             <select 
               value={selectedTemplateKey} 
               onChange={e => setSelectedTemplateKey(e.target.value)}
               className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
             >
               {TEMPLATE_KEYS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
             </select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={selectedTemplate.subject} onChange={e => updateTemplateField("subject", e.target.value)} placeholder="Email subject line..." />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>HTML Content</Label>
              <div className="flex border rounded-md overflow-hidden bg-white">
                 <button onClick={() => setEditorTab("code")} className={`px-3 py-1 text-xs ${editorTab === 'code' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Code</button>
                 <button onClick={() => setEditorTab("preview")} className={`px-3 py-1 text-xs ${editorTab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Preview</button>
              </div>
            </div>
            {editorTab === 'code' ? (
              <textarea 
                value={selectedTemplate.htmlBody}
                onChange={e => updateTemplateField("htmlBody", e.target.value)}
                rows={12}
                className="w-full rounded-md border border-input bg-slate-950 text-emerald-400 px-4 py-3 text-sm font-mono"
              />
            ) : (
              <div className="border rounded-md p-4 bg-white min-h-[300px]">
                 <iframe srcDoc={selectedTemplate.htmlBody} className="w-full h-[300px]" />
              </div>
            )}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
             <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Placeholders</p>
             <div className="flex flex-wrap gap-1.5">
               {PLACEHOLDERS.map(ph => (
                 <button 
                  key={ph} 
                  onClick={() => updateTemplateField("htmlBody", (selectedTemplate.htmlBody || "") + ph)}
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
