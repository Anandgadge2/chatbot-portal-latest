"use client";

import React, { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Power, User as UserIcon } from "lucide-react";
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
  onOpenMobileMenu: () => void;
  onProfileClick: () => void;
  notifications?: any[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: any) => void;
  onLogout: () => void;
  onRefresh?: () => void;
  onBackToDashboard?: () => void;
  isRefreshing?: boolean;
};

import { NotificationPopover } from "./NotificationPopover";
import { RefreshCw } from "lucide-react";

export const DashboardHeader = memo(function DashboardHeader({
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
  onOpenMobileMenu,
  onProfileClick,
  notifications = [],
  unreadCount = 0,
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onNotificationClick = () => {},
  onLogout,
  onRefresh,
  onBackToDashboard,
  isRefreshing = false,
}: DashboardHeaderProps) {
  return (
    <header className="bg-slate-900 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 transition-all duration-300 shadow-xl overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/4 h-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      
      {/* Content wrapper */}
      <div className="max-w-[1920px] mx-auto px-4 lg:px-6 relative z-10">
        <div className="flex items-center justify-between min-h-[3.25rem] py-1 sm:h-16">
          <div className="flex items-center gap-3 sm:gap-8 min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-6 group">
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="w-12 h-10 bg-white/50 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10 active:scale-95 transition-transform duration-300 md:hidden overflow-hidden"
                title="Open sidebar"
                aria-label="Open sidebar navigation"
              >
                <Image
                  src="/assets/sahaj.png"
                  alt="Sahaj Logo"
                  width={50}
                  height={50}
                  className="object-contain"
                />
              </button>
              <div className="hidden md:flex w-10 h-10 bg-white/5 backdrop-blur-sm rounded-xl items-center justify-center shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                <Image
                  src="/assets/sahaj.png"
                  alt="Sahaj Logo"
                  width={50}
                  height={50}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-lg sm:text-xl pt-2 font-black text-white tracking-tighter leading-none uppercase max-w-[45vw] sm:max-w-none whitespace-normal break-words drop-shadow-sm">
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
                  <p className="text-[11px] sm:text-[14px] text-white/80 font-bold uppercase tracking-[0.14em] max-w-[50vw] sm:max-w-none whitespace-normal break-words">
                    {isJharsugudaCompany
                      ? dashboardBrandSubtitle
                      : "Control Panel"}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                </div>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-800 hidden lg:block" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">


            <div className="hidden sm:flex flex-col items-end mr-2 sm:mr-3 lg:mr-0">
              <span className="hidden sm:block text-[14px] font-black text-white leading-none uppercase tracking-tight">
                {user.firstName} {user.lastName}
              </span>
              {isJharsugudaCompany ? (
                <span className="text-[14px] sm:text-[15px] font-black text-white uppercase tracking-wide mt-0.5 max-w-[220px] break-words text-right">
                  {(user.role || "CUSTOM").replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-[15px] font-black text-white/90 uppercase mt-0.5 bg-white/10 px-1.5 py-0.5 rounded border border-white/20 shadow-sm">
                  {(user.role || "CUSTOM").replace("_", " ")}
                  {user?.companyId?.name && ` (${user.companyId.name})`}
                </span>
              )}
            </div>

            <div className="w-px h-5 bg-slate-800 hidden lg:block mr-1" />

            {isSuperAdminUser && companyIdParam && (
              <button
                onClick={() => {
                  sessionStorage.removeItem("drilldownCompanyId");
                  if (onBackToDashboard) onBackToDashboard();
                }}
                className="h-8 px-2 sm:h-9 sm:px-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-indigo-500/20 text-[15px] sm:text-[15px] font-black uppercase tracking-widest flex items-center shrink-0 max-w-[70px] sm:max-w-none"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden text-[12px]">Back</span>
              </button>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="flex h-9 w-9 bg-white/10 backdrop-blur-sm rounded-xl items-center justify-center border border-white/20 shadow-lg group hover:bg-white/20 transition-all duration-300 active:scale-95 disabled:opacity-50"
                  title="Refresh Data"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("w-4.5 h-4.5 text-white group-hover:scale-110 transition-all duration-300", isRefreshing && "animate-spin")} />
                </button>
              )}
              <NotificationPopover
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={onMarkAsRead}
                onMarkAllAsRead={onMarkAllAsRead}
                onNotificationClick={onNotificationClick}
              />
              <button
                onClick={onLogout}
                className="flex h-9 w-9 bg-rose-500/10 backdrop-blur-sm rounded-xl items-center justify-center border border-rose-500/20 shadow-lg group hover:bg-rose-500/20 transition-all duration-300 active:scale-95"
                title="Logout"
                aria-label="Logout account"
              >
                <Power className="w-4.5 h-4.5 text-rose-500 group-hover:scale-110 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
