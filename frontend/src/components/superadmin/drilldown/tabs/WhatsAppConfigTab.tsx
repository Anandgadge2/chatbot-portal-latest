"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import {
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
  X,
  Eye,
  CheckCheck,
  Search,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  getPhoneNumberFormats,
  isValidPhoneNumber,
} from "@/lib/utils/phoneNumber";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Template Definitions
   Built-in system keys + any custom ones the company can create.
------------------------------------------------------------------ */
const TEMPLATE_GROUPS = [
  {
    label: "🏛️ Grievance Notifications (Admin)",
    description: "Sent to admin staff and department hierarchy",
    keys: [
      {
        key: "grievance_created_admin",
        label: "Grievance Received (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A citizen submits a new grievance through the chatbot",
      },
      {
        key: "grievance_assigned_admin",
        label: "Grievance Assigned (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is assigned to a department officer",
      },
      {
        key: "grievance_resolved_admin",
        label: "Grievance Resolved (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as RESOLVED by an officer",
      },
      {
        key: "grievance_rejected_admin",
        label: "Grievance Rejected (Admin/Hierarchy)",
        to: "Hierarchy & Company Admin",
        when: "A grievance is marked as REJECTED",
      },
    ],
  },
  {
    label: "👤 Grievance Notifications (Citizen)",
    description: "Sent to citizens about their grievance status",
    keys: [
      {
        key: "grievance_confirmation",
        label: "Grievance Confirmation (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after a grievance is submitted",
      },
      {
        key: "grievance_status_update",
        label: "Grievance Status Update (Citizen)",
        to: "Citizen (submitter)",
        when: "Grievance status changes (e.g. Assigned, Forwarded, Pending)",
      },
      {
        key: "grievance_resolved",
        label: "Grievance Resolved (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is successfully resolved",
      },
      {
        key: "grievance_rejected",
        label: "Grievance Rejected (Citizen)",
        to: "Citizen (submitter)",
        when: "The grievance is rejected/closed without resolution",
      },
    ],
  },
  {
    label: "📅 Appointment Notification (Company Admin)",
    description: "Sent to company admin for appointment events",
    keys: [
      {
        key: "appointment_created_admin",
        label: "Appointment Received (Company Admin)",
        to: "Company Admin",
        when: "A citizen books an appointment through the chatbot",
      },
      {
        key: "appointment_confirmed_admin",
        label: "Appointment Confirmed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is confirmed/scheduled",
      },
      {
        key: "appointment_cancelled_admin",
        label: "Appointment Cancelled (Company Admin)",
        to: "Company Admin",
        when: "An appointment is cancelled",
      },
      {
        key: "appointment_completed_admin",
        label: "Appointment Completed (Company Admin)",
        to: "Company Admin",
        when: "An appointment is marked as completed",
      },
    ],
  },
  {
    label: "👤 Appointment Notification (Citizen)",
    description: "Sent to citizens about their appointment status",
    keys: [
      {
        key: "appointment_confirmation",
        label: "Appointment Requested (Citizen)",
        to: "Citizen (submitter)",
        when: "Immediately after an appointment is booked",
      },
      {
        key: "appointment_scheduled_update",
        label: "Appointment Scheduled (Citizen)",
        to: "Citizen (submitter)",
        when: "Admin schedules a date & time for the appointment",
      },
      {
        key: "appointment_cancelled_update",
        label: "Appointment Cancelled (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is cancelled by the admin",
      },
      {
        key: "appointment_completed_update",
        label: "Appointment Completed (Citizen)",
        to: "Citizen (submitter)",
        when: "Appointment is successfully completed",
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

const BUILTIN_KEYS = TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

const KEY_META: Record<string, { label: string; to: string; when: string }> =
  Object.fromEntries(
    TEMPLATE_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, k])),
  );

const WA_PLACEHOLDERS: Array<{
  ph: string;
  desc: string;
  relevance: string[];
}> = [
  { ph: "{companyName}", desc: "Organisation name", relevance: ["all"] },
  { ph: "{recipientName}", desc: "Recipient name", relevance: ["all"] },
  { ph: "{citizenName}", desc: "Citizen name", relevance: ["all"] },
  { ph: "{citizenPhone}", desc: "Citizen phone number", relevance: ["all"] },
  { ph: "{grievanceId}", desc: "Grievance ID", relevance: ["grievance"] },
  { ph: "{appointmentId}", desc: "Appointment ID", relevance: ["appointment"] },
  { ph: "{departmentName}", desc: "Department name", relevance: ["all"] },
  { ph: "{subDepartmentName}", desc: "Sub-department name", relevance: ["all"] },
  { ph: "{deptLabel}", desc: "Smart Dept (hides if empty)", relevance: ["all"] },
  { ph: "{subDeptLabel}", desc: "Smart Sub-Dept (hides if empty)", relevance: ["all"] },
  { ph: "{descriptionLabel}", desc: "Smart Description (hides if empty)", relevance: ["grievance"] },
  { ph: "{remarksLabel}", desc: "Smart Remarks (hides if empty)", relevance: ["all"] },
  { ph: "{reasonLabel}", desc: "Smart Reason (hides if empty)", relevance: ["all"] },
  { ph: "{resolutionLabel}", desc: "Smart Resolution (hides if empty)", relevance: ["all"] },
  { ph: "{purposeLabel}", desc: "Smart Purpose (hides if empty)", relevance: ["appointment"] },
  { ph: "{description}", desc: "Grievance description", relevance: ["grievance"] },
  { ph: "{purpose}", desc: "Appointment purpose", relevance: ["appointment"] },
  { ph: "{assignedByName}", desc: "Assigned by name", relevance: ["assigned"] },
  { ph: "{formattedDate}", desc: "Date & time", relevance: ["all"] },
  { ph: "{resolvedByName}", desc: "Resolved by name", relevance: ["resolved"] },
  { ph: "{formattedResolvedDate}", desc: "Resolved date", relevance: ["resolved"] },
  { ph: "{resolutionTimeText}", desc: "Resolution duration", relevance: ["resolved"] },
  { ph: "{remarks}", desc: "Remarks / Notes", relevance: ["resolved", "cancelled"] },
  { ph: "{appointmentDate}", desc: "Appointment date", relevance: ["appointment"] },
  { ph: "{appointmentTime}", desc: "Appointment time", relevance: ["appointment"] },
  { ph: "{newStatus}", desc: "Updated status", relevance: ["status"] },
  { ph: "{oldStatus}", desc: "Previous status", relevance: ["status"] },
];

const DEFAULT_WA_MESSAGES: Record<string, string> = {
  grievance_created_admin: `*{companyName}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *NEW GRIEVANCE RECEIVED*\n\nRespected {recipientName},\nA new grievance has been submitted.\n\n🎫 *ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n📅 *On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  grievance_assigned_admin: `*{companyName}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *GRIEVANCE ASSIGNED*\n\nRespected {recipientName},\n\n🎫 *ID:* {grievanceId}\n👤 *Citizen:* {citizenName}{deptLabel}{subDeptLabel}{descriptionLabel}\n👨💼 *Assigned By:* {assignedByName}\n📅 *On:* {formattedDate}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  grievance_confirmation: `*{companyName}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *GRIEVANCE SUBMITTED*\n\nRespected {citizenName},\nYour grievance is registered.\n\n🎫 *Ref ID:* {grievanceId}{deptLabel}{subDeptLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  appointment_created_admin: `*{companyName}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *NEW APPOINTMENT*\n\nRespected {recipientName},\n\n🎫 *ID:* {appointmentId}\n👤 *Citizen:* {citizenName}{purposeLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  appointment_confirmation: `*{companyName}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ *APPOINTMENT REQUESTED*\n\nRespected {citizenName},\nYour request is received.\n\n🎫 *Ref ID:* {appointmentId}{purposeLabel}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  cmd_stop: "🛑 Conversation ended. Type 'hi' to restart.",
  cmd_restart: "🔄 Restarting...",
  cmd_menu: "🏠 Returning to menu.",
  cmd_back: "🔙 Going back.",
};

export interface WhatsAppConfigTabProps {
  companyId: string;
}

export default function WhatsAppConfigTab({ companyId }: WhatsAppConfigTabProps) {
  const { user } = useAuth();
  const { company } = useCompanyContext();
  const { data: cachedConfig } = useWhatsappConfig(companyId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<string>("grievance_created_admin");
  const [savingTemplates, setSavingTemplates] = useState(false);

  const [newTemplateKey, setNewTemplateKey] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState("");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    TEMPLATE_GROUPS.reduce((acc, g) => ({ ...acc, [g.label]: true }), {}),
  );
  const [isCustomCollapsed, setIsCustomCollapsed] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/whatsapp-config/company/${companyId}/templates`);
      const list = res?.data ?? [];

      const mergedTemplates = BUILTIN_KEYS.map(key => {
        const existing = Array.isArray(list) ? list.find((t: any) => t.templateKey === key) : null;
        return existing || {
          templateKey: key,
          label: KEY_META[key]?.label ?? key,
          message: DEFAULT_WA_MESSAGES[key] || "",
          keywords: [],
          isActive: true
        };
      });

      if (Array.isArray(list)) {
        list.forEach((t: any) => {
          if (!BUILTIN_KEYS.includes(t.templateKey)) mergedTemplates.push(t);
        });
      }
      setWaTemplates(mergedTemplates);
    } catch (error) {
      console.error(error);
      toast.error("Template synchronization failure");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setIsEditing(false);
    }
  }, [cachedConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const method = config?._id ? "put" : "post";
      const url = config?._id ? `/whatsapp-config/${config._id}` : "/whatsapp-config";
      await apiClient[method](url, config);
      toast.success("Connection matrix updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to commit changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsAppTemplates = async () => {
    try {
      setSavingTemplates(true);
      await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
        templates: waTemplates.map(t => ({
          ...t,
          isActive: t.isActive !== false
        }))
      });
      toast.success("Logic updated successfully");
      fetchData();
    } catch (error) {
      toast.error("Save failure");
    } finally {
      setSavingTemplates(false);
    }
  };

  const currentWaTemplate = waTemplates.find(t => t.templateKey === selectedWaTemplate) || {
    templateKey: selectedWaTemplate,
    message: DEFAULT_WA_MESSAGES[selectedWaTemplate] || "",
    keywords: [],
    isActive: true
  };

  const updateSelectedField = (field: string, value: any) => {
    setWaTemplates(prev => {
      const idx = prev.findIndex(t => t.templateKey === selectedWaTemplate);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value };
        return next;
      }
      return [...prev, { templateKey: selectedWaTemplate, [field]: value, isActive: true }];
    });
  };

  const addPlaceholder = (ph: string) => {
    updateSelectedField("message", (currentWaTemplate.message || "") + ph);
  };

  const handleAddTemplate = () => {
    if (!newTemplateKey || !newTemplateLabel) return toast.error("Required fields missing");
    const slug = newTemplateKey.toLowerCase().replace(/\s+/g, "_");
    setWaTemplates(prev => [...prev, { templateKey: slug, label: newTemplateLabel, keywords: [] }]);
    setSelectedWaTemplate(slug);
    setIsAddingTemplate(false);
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  if (loading) return <LoadingSpinner text="Retrieving matrix..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">WhatsApp API Config</h2>
          <p className="text-[10px] text-slate-500 font-medium">Meta Business Integration</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="font-bold text-[10px] uppercase">
              Edit Params
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm" className="bg-indigo-600 font-bold text-[10px] uppercase">
                {saving ? "Deploying..." : "Commit Changes"}
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm" className="text-[10px] uppercase">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Connection Params */}
        <div className="space-y-6">
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="bg-slate-900 py-3">
              <CardTitle className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Phone className="w-3 h-3 text-indigo-400" /> Connection Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase text-slate-500">Official Phone Number</Label>
                <Input 
                  value={config?.phoneNumber || ""} 
                  onChange={e => setConfig({...config, phoneNumber: e.target.value})}
                  disabled={!isEditing}
                  className="h-9 text-xs font-bold"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[9px] font-black uppercase text-slate-500">Messenger pipeline</Label>
                <Switch 
                  checked={config?.chatbotSettings?.isEnabled}
                  onCheckedChange={checked => setConfig({...config, chatbotSettings: {...config.chatbotSettings, isEnabled: checked}})}
                  disabled={!isEditing}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Notification Designer */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="rounded-xl shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-900 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Bell className="w-3 h-3 text-emerald-400" /> Outbound Designer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col md:flex-row min-h-[500px]">
              {/* Sidebar */}
              <div className="w-full md:w-64 border-r bg-slate-50/30 overflow-y-auto max-h-[700px]">
                 {TEMPLATE_GROUPS.map(group => (
                   <div key={group.label} className="border-b">
                     <div onClick={() => toggleGroup(group.label)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{group.label}</span>
                        {collapsedGroups[group.label] ? <ChevronRight className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                     </div>
                     {!collapsedGroups[group.label] && (
                       <div className="pb-1 bg-white">
                          {group.keys.map(k => {
                            const template = waTemplates?.find((t: any) => t.templateKey === k.key);
                            const isActive = template?.isActive !== false;
                            
                            return (
                              <div 
                                key={k.key} 
                                onClick={() => setSelectedWaTemplate(k.key)}
                                className={cn(
                                  "px-4 py-3 cursor-pointer border-l-2 text-[11px] font-bold flex items-center justify-between", 
                                  selectedWaTemplate === k.key 
                                    ? "bg-indigo-50 border-indigo-500 text-indigo-700" 
                                    : "border-transparent hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                 <span>{k.label}</span>
                                 {!isActive && (
                                   <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Disabled" />
                                 )}
                              </div>
                            );
                          })}
                       </div>
                     )}
                   </div>
                 ))}
                 <div className="p-3">
                   <Button onClick={() => setIsAddingTemplate(true)} variant="outline" className="w-full h-8 text-[9px] font-black uppercase border-dashed">
                      Add Custom Scenario
                   </Button>
                 </div>
              </div>

              {/* Editor */}
              <div className="flex-1 p-6 space-y-4 bg-white relative">
                 <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <div>
                          <h3 className="text-xs font-black uppercase text-slate-800">{currentWaTemplate.label || selectedWaTemplate}</h3>
                          <p className="text-[10px] text-slate-500 mt-1 italic">{KEY_META[selectedWaTemplate]?.when || "Manual Trigger"}</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                           <Label htmlFor="template-active-switch" className="text-[9px] font-black uppercase text-emerald-700 cursor-pointer select-none">
                              {currentWaTemplate.isActive !== false ? "Active" : "Inactive"}
                           </Label>
                           <Switch 
                              id="template-active-switch"
                              checked={currentWaTemplate.isActive !== false}
                              onCheckedChange={async (checked) => {
                                // 🔄 UPDATE: Instant save on toggle to ensure it's "automatically used in the flow"
                                updateSelectedField("isActive", checked);
                                
                                // We need the updated list to send to backend, but setWaTemplates is async. 
                                // So we manually construct the updated list for the immediate save call.
                                const updatedTemplates = waTemplates.map(t => 
                                  t.templateKey === selectedWaTemplate ? { ...t, isActive: checked } : t
                                );
                                
                                try {
                                  setSavingTemplates(true);
                                  await apiClient.put(`/whatsapp-config/company/${companyId}/templates`, {
                                    templates: updatedTemplates.map(t => ({
                                      ...t,
                                      isActive: t.isActive !== false
                                    }))
                                  });
                                  toast.success(`Template ${checked ? 'activated' : 'deactivated'}`);
                                } catch (error) {
                                  toast.error("Failed to update status");
                                } finally {
                                  setSavingTemplates(false);
                                }
                              }}
                              className="scale-75 data-[state=checked]:bg-emerald-600"
                           />
                        </div>
                       <Button onClick={() => setIsPreviewOpen(true)} variant="outline" size="sm" className="h-8 text-[10px] font-bold border-indigo-200 text-indigo-600">
                          <Eye className="w-3 h-3 mr-1" /> Preview
                       </Button>
                       <Button 
                          onClick={handleSaveWhatsAppTemplates} 
                          disabled={savingTemplates}
                          size="sm" 
                          className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase px-4 shadow-sm transition-all"
                       >
                          {savingTemplates ? (
                            <LoadingSpinner className="w-3 h-3 mr-1" />
                          ) : (
                            <Save className="w-3 h-3 mr-1" />
                          )}
                          {savingTemplates ? "Updating..." : "Save Logic"}
                       </Button>
                    </div>
                 </div>

                 <textarea 
                    value={currentWaTemplate.message || ""} 
                    onChange={e => updateSelectedField("message", e.target.value)}
                    className="w-full min-h-[400px] p-4 text-xs font-bold font-mono bg-slate-50 border rounded-xl outline-none resize-none"
                 />

                 <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Placeholders</Label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 rounded-lg border">
                       {WA_PLACEHOLDERS.map(ph => (
                         <button key={ph.ph} onClick={() => addPlaceholder(ph.ph)} className="px-2 py-0.5 bg-white border rounded text-[9px] font-bold hover:border-indigo-500">{ph.ph}</button>
                       ))}
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative w-full max-w-[320px] h-[650px] bg-white rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden flex flex-col scale-90 sm:scale-100">
            {/* Top Bar / Notch */}
            <div className="h-6 w-32 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-20" />
            
            {/* WhatsApp Header */}
            <div className="bg-[#075E54] pt-8 pb-3 px-4 flex items-center gap-3 text-white">
               <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center overflow-hidden">
                  <Phone className="w-6 h-6 text-slate-500 translate-y-1" />
               </div>
               <div>
                 <h4 className="text-sm font-bold truncate leading-tight">{company?.name || "Official Support"}</h4>
                 <p className="text-[10px] opacity-80 font-medium">Online</p>
               </div>
               <div className="ml-auto flex gap-4 opacity-80">
                  <Eye className="w-4 h-4" />
                  <Search className="w-4 h-4" />
               </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 bg-[#E5DDD5] p-4 relative overflow-y-auto no-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' }}>
               <div className="flex flex-col gap-2">
                  <div className="self-start max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm relative group animate-in slide-in-from-left-2">
                     <div className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap text-slate-800">
                        {currentWaTemplate.message?.replace(/{(\w+)}/g, (_: string, k: string) => `*${k}*`) || "No content configured."}
                     </div>
                     <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                        <span className="text-[9px] font-bold">12:00 PM</span>
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                     </div>
                  </div>
               </div>
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white flex items-center gap-2">
               <div className="flex-1 h-10 bg-slate-100 rounded-full px-4 flex items-center text-slate-400 text-sm">
                  Type a message
               </div>
               <div className="h-10 w-10 rounded-full bg-[#128C7E] flex items-center justify-center shadow-md">
                  <MessageSquare className="w-5 h-5 text-white" />
               </div>
            </div>

            <Button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 h-9 w-9 p-0 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md border-0 z-[110]"
            >
                <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {isAddingTemplate && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center p-6">
            <Card className="w-full max-w-sm rounded-2xl shadow-xl">
               <CardHeader className="py-4 flex flex-row items-center justify-between border-b">
                  <CardTitle className="text-xs font-black uppercase">Initialize Scenario Node</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingTemplate(false)}><X className="w-4 h-4"/></Button>
               </CardHeader>
               <CardContent className="p-5 space-y-4">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Node Key</Label>
                     <Input value={newTemplateKey} onChange={e => setNewTemplateKey(e.target.value)} placeholder="feedback_node" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-500">Label</Label>
                     <Input value={newTemplateLabel} onChange={e => setNewTemplateLabel(e.target.value)} placeholder="Citizen Feedback" />
                  </div>
                  <Button onClick={handleAddTemplate} className="w-full bg-indigo-600 font-bold text-[11px] uppercase p-3 h-auto rounded-xl">Initialize Node</Button>
               </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}
