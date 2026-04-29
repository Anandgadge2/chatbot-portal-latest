"use client";

import type { ComponentType } from "react";
import {
  BellRing,
  Building,
  CalendarCheck,
  FileText,
  Layers,
  LayoutGrid,
  LocateFixed,
  Mail,
  MessageSquare,
  Power,
  RefreshCw,
  Shield,
  Target,
  TrendingUp,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type DashboardNavigationProps = {
  user: any;
  activeTab: string;
  companyIdParam?: string | null;
  isMobileTabMenuOpen: boolean;
  isSuperAdminUser: boolean;
  isCompanyAdminRole: boolean;
  isViewingCompany: boolean;
  isJharsugudaCompany: boolean;
  canViewAnalytics: boolean;
  canReadGrievance: boolean;
  canShowAppointmentsInView: boolean;
  canSeeDepartmentsTab: boolean;
  canSeeUsersTab: boolean;
  hasLeadCaptureModule: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onTabChange: (value: string) => void;
  onCloseMobileMenu: () => void;
  onLogout: () => void;
};

type NavItem = {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "rose" | "emerald";
  section?: "main" | "configuration";
};

const desktopTriggerClass =
  "w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200";

const mobileButtonClass =
  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200";

export function DashboardNavigation({
  user,
  activeTab,
  companyIdParam,
  isMobileTabMenuOpen,
  isSuperAdminUser,
  isCompanyAdminRole,
  isViewingCompany,
  isJharsugudaCompany,
  canViewAnalytics,
  canReadGrievance,
  canShowAppointmentsInView,
  canSeeDepartmentsTab,
  canSeeUsersTab,
  hasLeadCaptureModule,
  refreshing,
  onRefresh,
  onTabChange,
  onCloseMobileMenu,
  onLogout,
}: DashboardNavigationProps) {
  const mainItems: NavItem[] = [
    ...(isSuperAdminUser || canViewAnalytics
      ? [{ value: "overview", label: "Overview", icon: LayoutGrid }]
      : []),
    ...(!isSuperAdminUser || (isSuperAdminUser && companyIdParam)
      ? [
          {
            value: "analytics",
            label: "Analytics",
            icon: TrendingUp,
          },
        ]
      : []),
    ...(canReadGrievance
      ? [
          {
            value: "grievances",
            label: "Grievances",
            icon: FileText,
          },
        ]
      : []),
    ...((isCompanyAdminRole || (isSuperAdminUser && companyIdParam)) &&
    canShowAppointmentsInView
      ? [{ value: "appointments", label: "Appointments", icon: CalendarCheck }]
      : []),
    ...(canSeeDepartmentsTab
      ? [
          {
            value: "departments",
            label: "Departments",
            icon: Building,
          },
        ]
      : []),
    ...(canSeeUsersTab ? [{ value: "users", label: "Users", icon: Users }] : []),
    ...(hasLeadCaptureModule && isViewingCompany
      ? [{ value: "leads", label: "Leads", icon: Target }]
      : []),
  ];

  const configurationItems: NavItem[] =
    (isSuperAdminUser || user?.isSuperAdmin || user?.level === 0) && companyIdParam
      ? [
          { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
          { value: "flows", label: "Flows", icon: Workflow },
          { value: "notifications", label: "Notifications", icon: BellRing },
          { value: "email", label: "Email", icon: Mail },
          { value: "roles", label: "Roles", icon: Shield },
        ]
      : [];

  const getDesktopToneClass = (item: NavItem) => {
    if (item.tone === "rose") {
      return "w-full justify-start h-10 rounded-xl data-[state=active]:bg-rose-600 data-[state=active]:text-white";
    }
    if (item.tone === "emerald") {
      return "w-full justify-start h-10 rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white";
    }
    return desktopTriggerClass;
  };

  const renderDesktopItem = (item: NavItem) => {
    const Icon = item.icon;
    const isSpecial = item.tone === "rose" || item.tone === "emerald";
    return (
      <TabsTrigger
        key={item.value}
        value={item.value}
        className={getDesktopToneClass(item)}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span
          className={cn(
            isSpecial
              ? "ml-3 text-[11px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
              : "w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap",
          )}
        >
          {item.label}
        </span>
      </TabsTrigger>
    );
  };

  const renderMobileItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Button
        key={item.value}
        type="button"
        variant="ghost"
        onClick={() => onTabChange(item.value)}
        className={cn(
          mobileButtonClass,
          activeTab === item.value
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
            : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
        )}
      >
        <Icon className="w-4 h-4 mr-3" />
        {item.label}
      </Button>
    );
  };

  return (
    <>
      <aside className="hidden md:block sticky top-[84px] self-start z-30">
        <div className="group w-[72px] hover:w-[260px] transition-all duration-300 ease-out rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              disabled={refreshing}
              className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl text-slate-500 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
            >
              <RefreshCw
                className={cn("w-4 h-4 shrink-0", refreshing && "animate-spin")}
              />
              <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                Refresh Data
              </span>
            </Button>
          </div>
          <TabsList className="h-auto bg-transparent p-2 flex flex-col gap-1">
            {mainItems.map(renderDesktopItem)}
            {configurationItems.length > 0 && (
              <>
                <div className="h-px bg-slate-100 my-1 mx-2" />
                {configurationItems.map(renderDesktopItem)}
              </>
            )}
          </TabsList>
          
          <div className="mt-auto p-2 border-t border-slate-100">
            <Button
              onClick={onLogout}
              variant="ghost"
              className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
              title="Logout Account"
            >
              <Power className="w-4 h-4 shrink-0" />
              <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap font-bold text-xs uppercase tracking-wide">
                Logout
              </span>
            </Button>
          </div>
        </div>
      </aside>

      {isMobileTabMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onCloseMobileMenu}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
          />
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-2xl border-r border-slate-200 p-0 flex flex-col transform transition-all duration-500 ease-out overflow-hidden z-[80]",
              isMobileTabMenuOpen
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0",
            )}
          >
            <div className="bg-slate-900 p-4">
              <div className="flex items-center justify-end mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-white"
                  onClick={onCloseMobileMenu}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => onTabChange("profile")}
                  className="h-12 w-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-lg font-bold border-2 border-slate-800 shadow-xl hover:scale-105 transition-transform"
                >
                  {user.firstName[0]}
                  {user.lastName[0]}
                </button>
                <div>
                  <h4 className="text-sm font-black text-white leading-tight uppercase tracking-tight">
                    {user.firstName} {user.lastName}
                  </h4>
                  <div className="flex flex-col mt-0.5">
                    {isJharsugudaCompany ? (
                      <span className="text-[10px] font-black text-white uppercase tracking-wide mt-1 whitespace-normal break-words">
                        {(user.role || "CUSTOM").replace(/_/g, " ")}
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-wide leading-tight">
                          {(user.role || "CUSTOM").replace("_", " ")}
                        </span>
                        {user?.companyId?.name && (
                          <span className="text-[9px] font-bold text-white/60 uppercase tracking-tighter mt-0.5">
                            ({user.companyId.name})
                          </span>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        Online
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="px-2 py-3">
                <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">
                  Main Menu
                </h5>
                <div className="space-y-1.5">
                  {mainItems.map(renderMobileItem)}
                  {configurationItems.length > 0 && (
                    <>
                      <div className="h-px bg-slate-100 my-2 mx-2" />
                      <h5 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">
                        Configuration
                      </h5>
                      {configurationItems.map(renderMobileItem)}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                onClick={onLogout}
                variant="ghost"
                className="w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
              >
                <Power className="w-4 h-4 mr-3" />
                Logout Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
