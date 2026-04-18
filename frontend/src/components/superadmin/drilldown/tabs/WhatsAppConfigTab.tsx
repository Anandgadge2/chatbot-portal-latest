"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  ShieldCheck, 
  Key, 
  Globe, 
  Settings, 
  Save, 
  RefreshCw,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { whatsappAPI } from "@/lib/api/whatsapp";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface WhatsAppConfigTabProps {
  companyId: string;
}

const WhatsAppConfigTab: React.FC<WhatsAppConfigTabProps> = ({ companyId }) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await whatsappAPI.getConfig(companyId);
        if (response.success) {
          setConfig(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch WhatsApp config:", error);
        toast.error("Failed to load WhatsApp configuration");
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchConfig();
    }
  }, [companyId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner text="Connecting to Meta API Services..." />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-20 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Configuration Found</h3>
          <p className="text-sm text-slate-500">
            This company hasn&apos;t been configured with WhatsApp Business API credentials yet.
          </p>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            Initialize Configuration
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Credentials */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">Meta API Credentials</CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Manage WhatsApp Business Account access tokens</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number ID</label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 select-all">
                {config.phoneNumberId || "Not Set"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Account ID</label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 select-all">
                {config.businessAccountId || "Not Set"}
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Access Token (Permanent)</label>
              <div className="relative group">
                <input 
                  type="password" 
                  value={config.accessToken} 
                  readOnly
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 focus:outline-none"
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200">
                    <RefreshCw className="w-3 h-3 text-slate-400" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-0 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-emerald-50 border-b border-emerald-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-900">Phone Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
                <MessageSquare className="w-10 h-10 text-emerald-600" />
              </div>
              <h4 className="text-lg font-black text-slate-900">{config.displayPhoneNumber}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verified WhatsApp Number</p>
              
              <div className="mt-6 w-full pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${config.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {config.isActive ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Verification</span>
                  <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase">
                    <ShieldCheck className="w-3 h-3" /> Official
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">Chatbot Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Flow Engine Status</p>
                    <p className="text-[10px] text-slate-400 font-medium">Toggle all automated responses</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${config.chatbotSettings?.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${config.chatbotSettings?.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Default Language</label>
                  <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="or">Odia (ଓଡ଼ିଆ)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Welcome Message</label>
                  <textarea 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    defaultValue={config.chatbotSettings?.welcomeMessage}
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/20 transition-all border-0">
                <Save className="w-3.5 h-3.5 mr-2" />
                Commit Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h5 className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1">Production Security Protocol</h5>
          <p className="text-[11px] text-amber-700/80 font-medium leading-relaxed">
            Changing these credentials will immediately impact all active WhatsApp sessions for this organization. 
            Ensure your Webhook URL in the Meta Developer Portal matches the unified endpoint: <code className="bg-amber-100 px-1 rounded font-bold">https://api.pugarch.in/webhook</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfigTab;
