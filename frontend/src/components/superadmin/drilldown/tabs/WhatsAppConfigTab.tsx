"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Smartphone,
  ShieldCheck,
  Key,
  Settings,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import { useCachedQuery } from "@/lib/query/cache";
import { templateAPI } from "@/lib/api/template";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import TemplateFilters from "@/components/templates/TemplateFilters";
import TemplateTable from "@/components/templates/TemplateTable";
import TemplateDrawer from "@/components/templates/TemplateDrawer";
import { WhatsAppTemplate } from "@/types/whatsappTemplate";

interface WhatsAppConfigTabProps {
  companyId: string;
}

const WhatsAppConfigTab: React.FC<WhatsAppConfigTabProps> = ({ companyId }) => {
  const { data: config, isLoading: loadingConfig } = useWhatsappConfig(companyId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const {
    data: templatesResponse,
    isLoading: loadingTemplates,
    error: templatesError,
  } = useCachedQuery({
    queryKey: [
      "whatsapp-templates",
      companyId,
      search,
      status,
      language,
      category,
      refreshTick,
    ],
    queryFn: () =>
      templateAPI.getTemplates({
        companyId,
        search: search || undefined,
        status: status || undefined,
        language: language || undefined,
        category: category || undefined,
      }),
    staleTime: 60 * 1000,
    enabled: Boolean(companyId),
  });

  const templates = templatesResponse?.data ?? [];
  const languages = useMemo(
    () => Array.from(new Set(templates.map((template) => template.language))),
    [templates],
  );
  const categories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))),
    [templates],
  );

  const triggerRefresh = () => setRefreshTick((prev) => prev + 1);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await templateAPI.syncTemplates(companyId);
      triggerRefresh();
      toast.success("Templates synced from Meta successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to sync templates");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveMapping = async (
    templateName: string,
    mappings: Record<string, string>,
  ) => {
    try {
      setSavingMapping(true);
      await templateAPI.saveMapping({ companyId, templateName, mappings });
      triggerRefresh();
      setSelectedTemplate((prev) =>
        prev ? { ...prev, mapping: mappings } : prev,
      );
      toast.success("Template mapping saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save template mapping");
    } finally {
      setSavingMapping(false);
    }
  };

  const handleSendTemplate = async (payload: {
    to: string;
    templateName: string;
    parameters: string[];
    language: string;
  }) => {
    try {
      setSendingTemplate(true);
      await templateAPI.sendTemplate({
        companyId,
        to: payload.to,
        templateName: payload.templateName,
        parameters: payload.parameters,
        language: payload.language,
      });
      toast.success("Template message sent");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send template");
    } finally {
      setSendingTemplate(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner text="Loading WhatsApp configuration..." />
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
            This company does not have an active WhatsApp configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                Meta API Credentials
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Manage WhatsApp Business Account access tokens
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Phone Number ID
              </label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 break-all">
                {config.phoneNumberId || "Not Set"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Business Account ID
              </label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 break-all">
                {config.businessAccountId || config.wabaId || "Not Set"}
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Access Token (Permanent)
              </label>
              <input
                type="password"
                value={config.accessToken || ""}
                readOnly
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-emerald-50 border-b border-emerald-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-900">
                Phone Profile
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
                <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
              </div>
              <h4 className="text-lg font-black text-slate-900 break-all">
                {config.displayPhoneNumber || "Not linked"}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Verified WhatsApp Number
              </p>

              <div className="mt-6 w-full pt-6 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      config.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {config.isActive ? "ONLINE" : "OFFLINE"}
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

        <Card className="xl:col-span-2 border-0 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
                Chatbot Settings Snapshot
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Flow Engine Status</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {config.chatbotSettings?.isEnabled
                    ? "Enabled for automated responses"
                    : "Disabled"}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Default Language</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {config.chatbotSettings?.defaultLanguage || "en"}
                </p>
              </div>
              <div className="md:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Welcome Message</p>
                <p className="text-[11px] text-slate-500 mt-1 break-words">
                  {config.chatbotSettings?.welcomeMessage || "Welcome! How can we help you today?"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Template Management Dashboard
              </CardTitle>
              <CardDescription>
                View and sync templates, map variables, validate readiness, and send previews.
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={syncing} className="w-full sm:w-auto">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "🔄 Sync Templates"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          <TemplateFilters
            search={search}
            status={status}
            language={language}
            category={category}
            languages={languages}
            categories={categories}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onLanguageChange={setLanguage}
            onCategoryChange={setCategory}
          />

          {loadingTemplates ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner text="Loading templates..." />
            </div>
          ) : templatesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load templates. Please retry sync or refresh.
            </div>
          ) : (
            <TemplateTable
              templates={templates}
              onView={(template) => {
                setSelectedTemplate(template);
                setIsDrawerOpen(true);
              }}
              onUse={(template) => {
                setSelectedTemplate(template);
                setIsDrawerOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h5 className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1">
            Production Security Protocol
          </h5>
          <p className="text-[11px] text-amber-700/80 font-medium leading-relaxed">
            Changing credentials affects all active WhatsApp sessions for this organization.
            Verify webhook URL and token in Meta before syncing or sending templates.
          </p>
        </div>
      </div>

      <TemplateDrawer
        open={isDrawerOpen}
        template={selectedTemplate}
        companyId={companyId}
        isSavingMapping={savingMapping}
        isSending={sendingTemplate}
        onClose={() => setIsDrawerOpen(false)}
        onSaveMapping={handleSaveMapping}
        onSend={handleSendTemplate}
      />
    </div>
  );
};

export default WhatsAppConfigTab;
