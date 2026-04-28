"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Power, RefreshCw, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  user: any;
  companyName?: string | null;
  companyIdParam?: string | null;
  isSuperAdminUser: boolean;
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
  isJharsugudaCompany: boolean;
  canReadGrievance: boolean;
  dashboardBrandTitle: string;
  dashboardBrandSubtitle: string;
  refreshing: boolean;
  onOpenMobileMenu: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  onProfileClick: () => void;
};

export function DashboardHeader({
  user,
  companyName,
  companyIdParam,
  isSuperAdminUser,
  isCompanyLevel,
  isDepartmentLevel,
  isJharsugudaCompany,
  canReadGrievance,
  dashboardBrandTitle,
  dashboardBrandSubtitle,
  refreshing,
  onOpenMobileMenu,
  onRefresh,
  onLogout,
  onProfileClick,
}: DashboardHeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 transition-all duration-300 shadow-xl overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 relative z-10">
        <div className="flex items-center justify-between min-h-[3.25rem] py-1 sm:h-16">
          <div className="flex items-center gap-3 sm:gap-8 min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-6 group">
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 border border-slate-200 active:scale-95 transition-transform duration-300 md:hidden overflow-hidden"
                title="Open sidebar"
              >
                <Image
                  src="/assets/sahaj.png"
                  alt="Sahaj Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </button>
              <div className="hidden md:flex w-10 h-10 bg-white rounded-xl items-center justify-center shadow-lg shadow-indigo-900/20 border border-slate-200 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                <Image
                  src="/assets/sahaj.png"
                  alt="Sahaj Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-[12px] sm:text-sm font-black text-white tracking-tight leading-tight uppercase max-w-[45vw] sm:max-w-none whitespace-normal break-words">
                  {isSuperAdminUser && companyIdParam ? (
                    `Viewing: ${companyName || "..."}`
                  ) : (
                    <>
                      {isCompanyLevel &&
                        (isJharsugudaCompany
                          ? dashboardBrandTitle
                          : companyName || "...")}
                      {isDepartmentLevel &&
                        (isJharsugudaCompany
                          ? dashboardBrandTitle
                          : "Department")}
                      {!canReadGrievance &&
                        !isSuperAdminUser &&
                        "Operations Center"}
                      {canReadGrievance &&
                        !isCompanyLevel &&
                        !isSuperAdminUser &&
                        ""}
                    </>
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.14em] max-w-[50vw] sm:max-w-none whitespace-normal break-words">
                    {isJharsugudaCompany
                      ? dashboardBrandSubtitle
                      : "Control Panel"}
                  </p>
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-800 hidden lg:block" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden sm:flex flex-col items-end mr-2 sm:mr-3 lg:mr-0">
              <span className="hidden sm:block text-[10px] font-black text-white leading-none uppercase tracking-tight">
                {user.firstName} {user.lastName}
              </span>
              {isJharsugudaCompany ? (
                <span className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-wide mt-0.5 max-w-[220px] break-words text-right">
                  {(user.role || "CUSTOM").replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-[9px] font-black text-white/90 uppercase mt-0.5 bg-white/10 px-1.5 py-0.5 rounded border border-white/20 shadow-sm">
                  {(user.role || "CUSTOM").replace("_", " ")}
                  {user?.companyId?.name && ` (${user.companyId.name})`}
                </span>
              )}
            </div>

            <div className="w-px h-5 bg-slate-800 hidden lg:block mr-1" />

            {isSuperAdminUser && companyIdParam && (
              <Link
                href="/dashboard"
                className="h-8 px-2 sm:h-9 sm:px-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-indigo-500/20 text-[9px] sm:text-[11px] font-black uppercase tracking-widest flex items-center shrink-0 max-w-[70px] sm:max-w-none"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden text-[8px]">Back</span>
              </Link>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={onRefresh}
                variant="ghost"
                disabled={refreshing}
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-indigo-500/20 md:hidden flex items-center justify-center"
                title="Refresh data"
              >
                <RefreshCw
                  className={cn(
                    "w-4.5 h-4.5 sm:w-5 sm:h-5",
                    refreshing && "animate-spin",
                  )}
                />
              </Button>
              <Button
                onClick={onLogout}
                variant="ghost"
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 border border-transparent hover:border-rose-500/20 flex items-center justify-center"
                title="Logout Account"
              >
                <Power className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </Button>
              <button
                onClick={onProfileClick}
                className="flex h-9 w-9 sm:h-10 sm:w-10 bg-white/20 rounded-xl items-center justify-center border border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.1)] group hover:bg-white/30 transition-all duration-300 active:scale-95"
                title="Profile"
              >
                <UserIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white group-hover:scale-110 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
