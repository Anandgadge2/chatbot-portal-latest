"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { companyAPI, Company } from "@/lib/api/company";
import { Settings, Clock, Languages, Save, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyContext } from "@/contexts/CompanyContext";

interface CompanySettingsTabProps {
  company?: Company | null;
  onUpdate?: () => void;
}

export function CompanySettingsTab({ company: propCompany, onUpdate }: CompanySettingsTabProps) {
  const context = useCompanyContext();
  const companyData = propCompany || context?.company;
  const isLoading = context?.isLoading && !companyData;
  
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    defaultSlaHours: 120,
    name: "",
  });

  useEffect(() => {
    if (companyData) {
      setCompany(companyData);
      setFormData({
        defaultSlaHours: companyData?.slaSettings?.defaultSlaHours || 120,
        name: companyData?.name || "",
      });
    }
  }, [companyData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await companyAPI.updateMe({
        slaSettings: {
          defaultSlaHours: Number(formData.defaultSlaHours)
        }
      });
      if (response.success) {
        toast.success("Company settings updated");
        if (onUpdate) onUpdate();
        if (context?.setCompany) context.setCompany(response.data.company);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Governance Settings...</p>
      </div>
    );
  }

  if (!companyData && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-red-100 shadow-sm">
        <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
        <p className="text-sm font-bold text-red-900 uppercase tracking-widest">Settings Unavailable</p>
        <p className="text-xs text-red-500 font-bold uppercase tracking-tighter mt-1">Please check your connection or permissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Company Governance</h2>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Manage global thresholds and organizational standards</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-slate-900/20 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SLA Governance */}
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl group hover:border-indigo-200 transition-all">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">SLA Governance</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Service Level Agreement Thresholds</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Default Resolution Window (Hours)</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.defaultSlaHours}
                  onChange={(e) => setFormData({ ...formData, defaultSlaHours: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. 120"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hours</div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                * This threshold defines when a grievance is flagged as &quot;OVERDUE&quot; in the system. Changing this will affect all future and existing grievances that don&apos;t have a custom override.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-indigo-600 text-white border-none">
          <CardContent className="p-8 flex flex-col justify-between h-full">
            <div>
              <Settings className="w-12 h-12 text-white/20 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Governance Note</h3>
              <p className="text-sm text-indigo-100 font-medium leading-relaxed">
                As a Company Administrator, you define the operational pulse of your organization. The SLA thresholds set here ensure accountability across all departments.
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white/10 border-2 border-indigo-600 flex items-center justify-center text-[10px] font-black">
                    {i}
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">System Hardened & Validated</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
