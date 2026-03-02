'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Mail, Shield, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function EmailConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [templates, setTemplates] = useState<Array<{ templateKey: string; subject?: string; htmlBody?: string }>>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('grievance_created');
  const [savingTemplates, setSavingTemplates] = useState(false);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when companyId/role change only
  }, [companyId, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const companyRes = await apiClient.get(`/companies/${companyId}`);
      if (companyRes.success && companyRes.data?.company) {
        setCompany(companyRes.data.company);
      }
      try {
        const configRes = await apiClient.get(`/email-config/company/${companyId}`);
        if (configRes.success && configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else {
          setConfig({
            companyId,
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: '', pass: '' },
            fromEmail: '',
            fromName: companyRes.data?.company?.name || 'Dashboard Notifications',
            isActive: true
          });
          setIsEditing(true);
        }
      } catch (configError: any) {
        if (configError.response?.status === 404) {
          setConfig({
            companyId,
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: '', pass: '' },
            fromEmail: '',
            fromName: companyRes.data?.company?.name || 'Dashboard Notifications',
            isActive: true
          });
          setIsEditing(true);
        } else throw configError;
      }
      try {
        const templatesRes = await apiClient.get(`/email-config/company/${companyId}/templates`);
        if (templatesRes.success && Array.isArray(templatesRes.data)) {
          setTemplates(templatesRes.data);
        } else {
          setTemplates([
            { templateKey: 'grievance_created' },
            { templateKey: 'grievance_assigned' },
            { templateKey: 'grievance_resolved' },
            { templateKey: 'appointment_created' },
            { templateKey: 'appointment_assigned' },
            { templateKey: 'appointment_resolved' }
          ]);
        }
      } catch (_) {
        setTemplates([
          { templateKey: 'grievance_created' },
          { templateKey: 'grievance_assigned' },
          { templateKey: 'grievance_resolved' },
          { templateKey: 'appointment_created' },
          { templateKey: 'appointment_assigned' },
          { templateKey: 'appointment_resolved' }
        ]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load data');
      router.push(`/superadmin/company/${companyId}`);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const next = { ...prev };
      if (path === 'auth.user') {
        next.auth = { ...next.auth, user: value };
      } else if (path === 'auth.pass') {
        next.auth = { ...next.auth, pass: value };
      } else if (path.includes('.')) {
        const [a, b] = path.split('.');
        next[a] = { ...next[a], [b]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!config?.host || !config?.auth?.user || !config?.auth?.pass || !config?.fromEmail || !config?.fromName) {
      toast.error('Host, SMTP user, password, from email and from name are required');
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
        isActive: config.isActive !== false
      };
      const existingRes = await apiClient.get(`/email-config/company/${companyId}`).catch(() => null);
      if (existingRes?.success && existingRes.data?._id) {
        await apiClient.put(`/email-config/${existingRes.data._id}`, payload);
        toast.success('Email configuration updated');
      } else {
        await apiClient.post('/email-config', payload);
        toast.success('Email configuration created');
      }
      setIsEditing(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Send current state for testing so user can verify before saving
      const portNum = Number(config.port) || 465;
      const testPayload = {
        host: config.host,
        port: portNum,
        secure: portNum === 465,
        auth: config.auth,
        fromEmail: config.fromEmail
      };
      
      await apiClient.post(`/email-config/company/${companyId}/test`, testPayload);
      toast.success('SMTP connection successful');
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'SMTP test failed');
    } finally {
      setTesting(false);
    }
  };

  const selectedTemplate = templates.find(t => t.templateKey === selectedTemplateKey) || { templateKey: selectedTemplateKey, subject: '', htmlBody: '' };
  const updateTemplateField = (field: 'subject' | 'htmlBody', value: string) => {
    setTemplates(prev => {
      const found = prev.some(t => t.templateKey === selectedTemplateKey);
      if (found) return prev.map(t => t.templateKey === selectedTemplateKey ? { ...t, [field]: value } : t);
      return [...prev, { templateKey: selectedTemplateKey, subject: field === 'subject' ? value : '', htmlBody: field === 'htmlBody' ? value : '' }];
    });
  };
  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await apiClient.put(`/email-config/company/${companyId}/templates`, {
        templates: templates.filter(t => t.subject || t.htmlBody).map(t => ({ templateKey: t.templateKey, subject: t.subject || '', htmlBody: t.htmlBody || '' }))
      });
      toast.success('Email templates saved');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save templates');
    } finally {
      setSavingTemplates(false);
    }
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
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">SMTP Relay Matrix</h1>
                <div className="flex items-center gap-2 mt-1.5">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                     Mailing Node: <span className="text-indigo-400">{company?.name}</span>
                   </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {config?._id && (
                <Button
                  onClick={handleTest}
                  disabled={testing || isEditing}
                  variant="ghost"
                  className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 font-bold text-[11px] uppercase tracking-wider"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {testing ? 'Verifying...' : 'Test Connection'}
                </Button>
              )}
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-bold text-[11px] uppercase tracking-wider border-0"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Processing...' : 'Deploy Changes'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setIsEditing(false); fetchData(); }}
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
        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white mt-6">
          <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              SMTP Relay Infrastructure Settings
            </CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Custom Outbound Mailing Services</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host *</Label>
                <Input
                  id="host"
                  placeholder="smtp.gmail.com"
                  value={config?.host || ''}
                  onChange={(e) => updateConfig('host', e.target.value)}
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
                  onChange={(e) => updateConfig('port', e.target.value)}
                  disabled={!isEditing}
                />
                <p className="text-xs text-muted-foreground">465 (SSL) or 587 (STARTTLS)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth.user">SMTP User (email) *</Label>
                <Input
                  id="auth.user"
                  type="email"
                  placeholder="noreply@example.com"
                  value={config?.auth?.user || ''}
                  onChange={(e) => updateConfig('auth.user', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth.pass">SMTP Password *</Label>
                <Input
                  id="auth.pass"
                  type="password"
                  placeholder="••••••••"
                  value={config?.auth?.pass || ''}
                  onChange={(e) => updateConfig('auth.pass', e.target.value)}
                  disabled={!isEditing}
                />
                {config?.auth?.pass && !isEditing && (
                  <p className="text-xs text-muted-foreground">Password is hidden</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email *</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  placeholder="noreply@company.com"
                  value={config?.fromEmail || ''}
                  onChange={(e) => updateConfig('fromEmail', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name *</Label>
                <Input
                  id="fromName"
                  placeholder="Zilla Parishad Amravati"
                  value={config?.fromName || ''}
                  onChange={(e) => updateConfig('fromName', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="isActive"
                  checked={config?.isActive !== false}
                  onCheckedChange={(checked) => updateConfig('isActive', checked)}
                  disabled={!isEditing}
                />
                <Label htmlFor="isActive">Active (use this config for sending)</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
               Mailing Payload Templates
            </CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Customize email subject and HTML content</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <select
                value={selectedTemplateKey}
                onChange={(e) => setSelectedTemplateKey(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                <option value="grievance_created">Grievance – New (to dept admin)</option>
                <option value="grievance_assigned">Grievance – Assigned to you</option>
                <option value="grievance_resolved">Grievance – Resolved</option>
                <option value="appointment_created">Appointment – New</option>
                <option value="appointment_assigned">Appointment – Assigned to you</option>
                <option value="appointment_resolved">Appointment – Resolved</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="e.g. New Grievance - {grievanceId} | {companyName}"
                value={selectedTemplate?.subject || ''}
                onChange={(e) => updateTemplateField('subject', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>HTML Body</Label>
              <textarea
                placeholder="HTML with placeholders. Leave empty for default."
                value={selectedTemplate?.htmlBody || ''}
                onChange={(e) => updateTemplateField('htmlBody', e.target.value)}
                rows={8}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button 
                  onClick={handleSaveTemplates} 
                  disabled={savingTemplates}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 text-[11px] font-bold uppercase tracking-wider px-6 border-0 shadow-lg shadow-indigo-900/20"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingTemplates ? 'Saving...' : 'Commit Templates'}
                </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
