"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { isSuperAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import WhatsAppConfigTab from "@/components/superadmin/drilldown/tabs/WhatsAppConfigTab";

export default function WhatsAppConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { company } = useCompanyContext();
  const companyId = params.id as string;

  useEffect(() => {
    if (!isSuperAdmin(user)) {
      router.push("/superadmin/dashboard");
    }
  }, [router, user]);

  if (!isSuperAdmin(user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-slate-900 sticky top-0 z-50 shadow-2xl border-b border-slate-800">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                onClick={() => router.push(`/superadmin/company/${companyId}`)}
                className="text-slate-400 hover:text-white hover:bg-white/10 transition-all -ml-2 h-9 w-9 p-0 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  WhatsApp Configuration
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 truncate">
                  Meta Business Setup
                  {company?.name ? ` • ${company.name}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-4 py-6">
        <WhatsAppConfigTab companyId={companyId} />
      </main>
    </div>
  );
}
