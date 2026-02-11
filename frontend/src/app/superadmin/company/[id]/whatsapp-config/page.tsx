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
import { ArrowLeft, Save, Phone, Shield, MessageSquare, Clock, Globe, FileText } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const WHATSAPP_TEMPLATE_KEYS = [
  { key: 'grievance_created', label: 'Grievance Created (to dept admin)' },
  { key: 'grievance_assigned', label: 'Grievance Assigned (to assigned user)' },
  { key: 'grievance_resolved', label: 'Grievance Resolved (citizen + hierarchy)' },
  { key: 'appointment_created', label: 'Appointment Created (to admin)' },
  { key: 'appointment_assigned', label: 'Appointment Assigned (to assigned user)' },
  { key: 'appointment_resolved', label: 'Appointment Resolved (citizen + hierarchy)' }
];
const PLACEHOLDERS = 'Placeholders: {companyName}, {recipientName}, {citizenName}, {citizenPhone}, {grievanceId}, {appointmentId}, {departmentName}, {description}, {purpose}, {assignedByName}, {formattedDate}, {resolvedByName}, {remarks}, {oldStatus}, {newStatus}';

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
  const [waTemplates, setWaTemplates] = useState<Array<{ templateKey: string; message?: string }>>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<string>('grievance_created');
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
      
      // Fetch company
      const companyRes = await apiClient.get(`/companies/${companyId}`);
      if (companyRes.success && companyRes.data?.company) {
        setCompany(companyRes.data.company);
      } else if (companyRes.data?.company) {
        setCompany(companyRes.data.company);
      }

      // Fetch WhatsApp config
      try {
        const configRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
        if (configRes.success && configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else if (configRes.data) {
          setConfig(configRes.data);
          setIsEditing(false);
        } else {
          setConfig({
            companyId,
            phoneNumber: '',
            displayPhoneNumber: '',
            phoneNumberId: '',
            businessAccountId: '',
            accessToken: '',
            verifyToken: '',
            chatbotSettings: {
              isEnabled: true,
              defaultLanguage: 'en',
              supportedLanguages: ['en'],
              welcomeMessage: 'Welcome! How can we help you today?',
              businessHours: {
                enabled: false,
                timezone: 'Asia/Kolkata',
                schedule: []
              }
            },
            rateLimits: {
              messagesPerMinute: 60,
              messagesPerHour: 1000,
              messagesPerDay: 10000
            },
            isActive: true
          });
          setIsEditing(true); // Start in edit mode for new config
        }
      } catch (configError: any) {
        // If 404, initialize empty config (first time setup)
        if (configError.response?.status === 404 || configError.response?.status === 400) {
          setConfig({
            companyId,
            phoneNumber: '',
            displayPhoneNumber: '',
            phoneNumberId: '',
            businessAccountId: '',
            accessToken: '',
            verifyToken: '',
            chatbotSettings: {
              isEnabled: true,
              defaultLanguage: 'en',
              supportedLanguages: ['en'],
              welcomeMessage: 'Welcome! How can we help you today?',
              businessHours: {
                enabled: false,
                timezone: 'Asia/Kolkata',
                schedule: []
              }
            },
            rateLimits: {
              messagesPerMinute: 60,
              messagesPerHour: 1000,
              messagesPerDay: 10000
            },
            isActive: true
          });
          setIsEditing(true);
        } else {
          console.error('❌ Error loading config:', configError);
          throw configError;
        }
      }

      try {
        const templatesRes = await apiClient.get<{ success?: boolean; data?: Array<{ templateKey: string; message?: string }> }>(`/whatsapp-config/company/${companyId}/templates`);
        const list = (templatesRes as any)?.data ?? (templatesRes as any);
        if (Array.isArray(list) && list.length > 0) {
          setWaTemplates(list);
        } else {
          setWaTemplates(WHATSAPP_TEMPLATE_KEYS.map(t => ({ templateKey: t.key })));
        }
      } catch (_) {
        setWaTemplates(WHATSAPP_TEMPLATE_KEYS.map(t => ({ templateKey: t.key })));
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsAppTemplates = async () => {
    try {
      setSavingTemplates(true);
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates.filter(t => t.templateKey).map(t => ({ templateKey: t.templateKey, message: t.message ?? '' }))
      });
      toast.success('WhatsApp templates saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save WhatsApp templates');
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
          const existingRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
          if (existingRes.success && existingRes.data?._id) {
            existingConfigId = existingRes.data._id;
          } else if (existingRes.data?._id) {
            existingConfigId = existingRes.data._id;
          }
        } catch (_) {}
      }
      const url = existingConfigId ? `/whatsapp-config/${existingConfigId}` : '/whatsapp-config';
      const method = existingConfigId ? 'put' : 'post';
      const res = await apiClient[method](url, config);
      
      // apiClient methods return response.data directly
      if (res?.success === true) {
        toast.success(res.message || 'WhatsApp configuration saved successfully');
        setIsEditing(false);
        fetchData(); // Reload to get the updated config with _id
      } else if (res?.data) {
        toast.success('WhatsApp configuration saved successfully');
        setIsEditing(false);
        fetchData();
      } else {
        toast.error(res?.message || 'Failed to save configuration');
      }
    } catch (error: any) {
      
      // Handle "already exists" error - try to update instead
      if (error.response?.status === 400 && 
          error.response?.data?.message?.includes('already exists')) {
        try {
          const existingRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
          const existingConfig = existingRes.success ? existingRes.data : existingRes.data;
          
          if (existingConfig?._id) {
            const updateRes = await apiClient.put(`/whatsapp-config/${existingConfig._id}`, config);
            if (updateRes?.success) {
              toast.success('WhatsApp configuration updated successfully');
              setIsEditing(false);
              fetchData();
              return;
            }
          }
        } catch (_) {}
      }
      toast.error(error.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      const keys = path.split('.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push(`/superadmin/company/${companyId}`)} 
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Company
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">WhatsApp Configuration</h1>
                <p className="text-sm text-white/80 mt-0.5">{company?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-white text-green-600 hover:bg-white/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      fetchData();
                    }}
                    className="text-white border-white/30 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-white text-green-600 hover:bg-white/90"
                >
                  Edit Configuration
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* WhatsApp Business API Credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                WhatsApp Business API Credentials
              </CardTitle>
              <CardDescription>
                Configure your WhatsApp Business API connection for this company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-semibold">Phone Number</Label>
                  <Input 
                    id="phoneNumber"
                    placeholder="e.g., 9821550841"
                    value={config?.phoneNumber || ''} 
                    onChange={(e) => updateConfig('phoneNumber', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayPhoneNumber" className="text-sm font-semibold">Display Phone Number</Label>
                  <Input 
                    id="displayPhoneNumber"
                    placeholder="e.g., +91 98215 50841"
                    value={config?.displayPhoneNumber || ''} 
                    onChange={(e) => updateConfig('displayPhoneNumber', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId" className="text-sm font-semibold">Phone Number ID</Label>
                  <Input 
                    id="phoneNumberId"
                    placeholder="From Meta Business Manager"
                    value={config?.phoneNumberId || ''} 
                    onChange={(e) => updateConfig('phoneNumberId', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="businessAccountId" className="text-sm font-semibold">Business Account ID</Label>
                  <Input 
                    id="businessAccountId"
                    placeholder="WhatsApp Business Account ID"
                    value={config?.businessAccountId || ''} 
                    onChange={(e) => updateConfig('businessAccountId', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="accessToken" className="text-sm font-semibold">Access Token</Label>
                  <Input 
                    id="accessToken"
                    type="password"
                    placeholder="Enter WhatsApp Access Token"
                    value={config?.accessToken || ''} 
                    onChange={(e) => updateConfig('accessToken', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                  {config?.accessToken && !isEditing && (
                    <p className="text-xs text-gray-500 mt-1">Token is hidden for security</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="verifyToken" className="text-sm font-semibold">Webhook Verify Token</Label>
                  <Input 
                    id="verifyToken"
                    placeholder="Your webhook verification token"
                    value={config?.verifyToken || ''} 
                    onChange={(e) => updateConfig('verifyToken', e.target.value)}
                    disabled={!isEditing}
                    className="rounded-xl border-gray-200 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="isActive"
                    checked={config?.isActive || false}
                    onCheckedChange={(checked) => updateConfig('isActive', checked)}
                    disabled={!isEditing}
                  />
                  <Label htmlFor="isActive" className="text-sm font-semibold">Active</Label>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Chatbot Settings
              </CardTitle>
              <CardDescription>
                Configure chatbot behavior and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="chatbotEnabled"
                    checked={config?.chatbotSettings?.isEnabled || false}
                    onCheckedChange={(checked) => updateConfig('chatbotSettings.isEnabled', checked)}
                    disabled={!isEditing}
                  />
                  <Label htmlFor="chatbotEnabled">Enable Chatbot</Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="defaultLanguage">Default Language</Label>
                  <select
                    id="defaultLanguage"
                    value={config?.chatbotSettings?.defaultLanguage || 'en'}
                    onChange={(e) => updateConfig('chatbotSettings.defaultLanguage', e.target.value)}
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
                    value={config?.chatbotSettings?.welcomeMessage || ''}
                    onChange={(e) => updateConfig('chatbotSettings.welcomeMessage', e.target.value)}
                    disabled={!isEditing}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Message Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                WhatsApp Message Templates
              </CardTitle>
              <CardDescription>
                Customize notification messages sent via WhatsApp. Leave empty to use default messages. Use placeholders like {'{citizenName}'}, {'{grievanceId}'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 sm:w-64">
                  <Label className="text-sm font-semibold">Template</Label>
                  <select
                    value={selectedWaTemplate}
                    onChange={(e) => setSelectedWaTemplate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {WHATSAPP_TEMPLATE_KEYS.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-semibold">Message (leave empty for default)</Label>
                  <textarea
                    rows={8}
                    placeholder="*{companyName}*\n\nNew grievance received.\nReference: {grievanceId}\nCitizen: {citizenName}\n..."
                    value={waTemplates.find(t => t.templateKey === selectedWaTemplate)?.message ?? ''}
                    onChange={(e) => {
                      const key = selectedWaTemplate;
                      setWaTemplates(prev => {
                        const next = prev.map(t => t.templateKey === key ? { ...t, message: e.target.value } : t);
                        if (!next.find(t => t.templateKey === key)) next.push({ templateKey: key, message: e.target.value });
                        return next;
                      });
                    }}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{PLACEHOLDERS}</p>
                </div>
              </div>
              <Button onClick={handleSaveWhatsAppTemplates} disabled={savingTemplates}>
                <Save className="w-4 h-4 mr-2" />
                {savingTemplates ? 'Saving...' : 'Save WhatsApp Templates'}
              </Button>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Rate Limits
              </CardTitle>
              <CardDescription>
                Configure message rate limiting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="perMinute">Messages Per Minute</Label>
                  <Input 
                    id="perMinute"
                    type="number"
                    value={config?.rateLimits?.messagesPerMinute || 60} 
                    onChange={(e) => updateConfig('rateLimits.messagesPerMinute', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="perHour">Messages Per Hour</Label>
                  <Input 
                    id="perHour"
                    type="number"
                    value={config?.rateLimits?.messagesPerHour || 1000} 
                    onChange={(e) => updateConfig('rateLimits.messagesPerHour', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="perDay">Messages Per Day</Label>
                  <Input 
                    id="perDay"
                    type="number"
                    value={config?.rateLimits?.messagesPerDay || 10000} 
                    onChange={(e) => updateConfig('rateLimits.messagesPerDay', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {config?._id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Statistics
                </CardTitle>
                <CardDescription>
                  Usage statistics for this WhatsApp configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Messages Sent</p>
                    <p className="text-2xl font-bold">{config.stats?.totalMessagesSent || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Messages Received</p>
                    <p className="text-2xl font-bold">{config.stats?.totalMessagesReceived || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversations</p>
                    <p className="text-2xl font-bold">{config.stats?.totalConversations || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Message</p>
                    <p className="text-sm font-medium">
                      {config.stats?.lastMessageAt 
                        ? new Date(config.stats.lastMessageAt).toLocaleDateString()
                        : 'Never'}
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
