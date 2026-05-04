"use client";

import { Building, Mail, Phone, User as UserIcon } from "lucide-react";
import Image from "next/image";
import type { Company } from "@/lib/api/company";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingDots } from "@/components/dashboard/DashboardPrimitives";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

type OverviewCompanyInfoCardProps = {
  company: Company | null;
  loadingStats: boolean;
  usersCount: number;
  departmentsCount: number;
  supportEmail?: string | null;
};

export function OverviewCompanyInfoCard({
  company,
  loadingStats,
  usersCount,
  departmentsCount,
  supportEmail,
}: OverviewCompanyInfoCardProps) {
  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white rounded-xl">
      <div className="bg-slate-900 px-6 py-2">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg overflow-hidden">
              {company?.theme?.logoUrl ? (
                <Image
                  src={company.theme.logoUrl}
                  alt={company.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              ) : (
                <Building className="text-white w-8 h-8" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">
                {company?.name || <LoadingDots />}
              </h3>
              <p className="text-white/60 text-[14px] font-bold uppercase tracking-widest mt-1">
                Company Profile & Statistics
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-1.5 sm:px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white text-[15px] sm:text-[15px] font-black uppercase tracking-wider shadow-sm truncate max-w-[80px] sm:max-w-none inline-flex items-center">
              {company?.companyType || <LoadingDots />}
            </span>
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
            <div className="flex items-center text-[14px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center mr-2 shadow-sm">
                <UserIcon className="w-3.5 h-3.5 text-blue-600" />
              </div>
              Staff/Users
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                {loadingStats ? <LoadingDots /> : usersCount}
              </span>
              <span className="text-[15px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                Live
              </span>
            </div>
          </div>

          <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
            <div className="flex items-center text-[14px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center mr-2 shadow-sm">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              Departments
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                {loadingStats ? <LoadingDots /> : departmentsCount}
              </span>
              <span className="text-[15px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                Verified
              </span>
            </div>
          </div>

          <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
            <div className="flex items-center text-[14px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <div className="w-6 h-6 bg-cyan-100 rounded flex items-center justify-center mr-2 shadow-sm">
                <Mail className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              Support Channel
            </div>
            <div className="text-xs font-bold text-slate-700 truncate">
              {supportEmail || <LoadingDots />}
            </div>
          </div>

          <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
            <div className="flex items-center text-[14px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center mr-2 shadow-sm">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              Direct Line
            </div>
            <div className="text-xs font-bold text-slate-700">
              {company ? formatTo10Digits(company.contactPhone) : <LoadingDots />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
