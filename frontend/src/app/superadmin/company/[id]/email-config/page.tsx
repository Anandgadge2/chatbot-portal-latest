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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/superadmin/company/${companyId}`)}
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Company
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Email (SMTP) Configuration</h1>
                <p className="text-sm text-white/80 mt-0.5">{company?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {config?._id && (
                <Button
                  onClick={handleTest}
                  disabled={testing || isEditing}
                  variant="default"
                  className="text-Black border-Black/30 hover:bg-Black/10"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              )}
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-white text-indigo-600 hover:bg-white/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setIsEditing(false); fetchData(); }}
                    className="text-white border-white/30 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-white text-indigo-600 hover:bg-white/90"
                >
                  Edit Configuration
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              SMTP Settings
            </CardTitle>
            <CardDescription>
              Configure SMTP for sending grievance, appointment and status emails for this company. Stored in database (not .env).
            </CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">📝 Email Templates</CardTitle>
            <CardDescription>
              Customize subject and body per notification type. Use placeholders: {'{companyName}'}, {'{recipientName}'}, {'{citizenName}'}, {'{grievanceId}'}, {'{appointmentId}'}, {'{departmentName}'}, {'{category}'}, {'{priority}'}, {'{description}'}, {'{purpose}'}, {'{createdAt}'}, {'{assignedByName}'}, {'{assignedAt}'}, {'{resolvedBy}'}, {'{resolvedAt}'}, {'{remarks}'}. Leave blank to use default template.
            </CardDescription>
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
            <Button onClick={handleSaveTemplates} disabled={savingTemplates}>
              {savingTemplates ? 'Saving...' : 'Save email templates'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
