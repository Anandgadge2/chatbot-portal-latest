"use client";

import { useEffect, useState, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { companyAPI, Company } from "@/lib/api/company";
import { departmentAPI, Department } from "@/lib/api/department";
import { userAPI, User } from "@/lib/api/user";
import { grievanceAPI, Grievance } from "@/lib/api/grievance";
import { appointmentAPI, Appointment } from "@/lib/api/appointment";
import { roleAPI, Role } from "@/lib/api/role";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { 
  Permission, 
  hasPermission, 
  Module, 
  isSuperAdmin,
  isCompanyAdminOrHigher,
  isDepartmentAdminOrHigher 
} from "@/lib/permissions";
import toast from "react-hot-toast";

// Import tabs and views
import GrievanceManagement from "../dashboard/tabs/GrievanceManagement";
import AppointmentManagement from "../dashboard/tabs/AppointmentManagement";
import AnalyticsTab from "../dashboard/tabs/AnalyticsTab";
import UserManagementTab from "../dashboard/tabs/UserManagementTab";
import SuperAdminView from "../dashboard/views/SuperAdminView";

import {
  BarChart2,
  Building,
  Settings,
  Users,
  Shield,
  Box,
  Terminal,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  Calendar,
  MessageSquare
} from "lucide-react";

export default function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Route state
  const companyIdParam = searchParams.get("companyId");
  const tabParam = searchParams.get("tab");
  
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(tabParam || "overview");
  const [company, setCompany] = useState<Company | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine if we are in "Super Admin Mode" or "Company Mode"
  const isViewingSpecificCompany = !!companyIdParam || (!isSuperAdmin(user) && user?.companyId);

  // Helper to check module access
  const hasModule = useCallback((mod: "grievances" | "appointments" | "users" | "analytics") => {
    if (!user) return false;
    
    // Super Admins see everything in global view
    if (isSuperAdmin(user) && !companyIdParam) return true;
    
    // If viewing a company, check the company's enabled modules
    const modules = (company?.enabledModules || user?.enabledModules || []) as string[];
    return modules.includes(mod);
  }, [user, company, companyIdParam]);

  const fetchCompanyData = useCallback(async () => {
    if (!companyIdParam) return;
    try {
      const res = await companyAPI.getById(companyIdParam);
      if (res.success) {
        setCompany(res.data.company);
      }
    } catch (error) {
      console.error("Failed to fetch company details", error);
    }
  }, [companyIdParam]);

  useEffect(() => {
    setMounted(true);
    if (companyIdParam) {
      fetchCompanyData();
    }
  }, [companyIdParam, fetchCompanyData]);

  // Sync tab with URL if needed (optional for pure SPA)
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger refreshes in child components or re-fetch company
    await fetchCompanyData();
    // Artificial delay for UX
    setTimeout(() => setIsRefreshing(false), 500);
    toast.success("Intelligence data synchronized");
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner text="Synchronizing Intelligence Network..." />
      </div>
    );
  }

  if (!user) return null;

  // Render Super Admin Global Dashboard if no company is selected and user is Super Admin
  if (isSuperAdmin(user) && !companyIdParam && activeTab === "overview") {
    return <SuperAdminView />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Premium Header */}
      <header className="bg-slate-900 sticky top-0 z-50 shadow-2xl border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 border border-indigo-400/30">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black text-white uppercase tracking-tighter leading-none">
                    Stitch Portal
                  </h1>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                    System Intelligence
                  </span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                  <TabsList className="bg-transparent h-16 p-0 gap-1">
                    <TabsTrigger 
                      value="overview"
                      className="px-5 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-400 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    
                    {hasModule("grievances") && (
                      <TabsTrigger 
                        value="grievances"
                        className="px-5 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-400 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Grievances
                      </TabsTrigger>
                    )}

                    {hasModule("appointments") && (
                      <TabsTrigger 
                        value="appointments"
                        className="px-5 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-400 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Appointments
                      </TabsTrigger>
                    )}

                    {hasModule("users") && (
                      <TabsTrigger 
                        value="users"
                        className="px-5 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white text-slate-400 font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Personnel
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>

              <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

              <div className="flex items-center gap-3 pl-2">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-xs font-bold text-white uppercase tracking-tight">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {user.role}
                  </span>
                </div>
                <Button
                  onClick={logout}
                  variant="ghost"
                  className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl px-3"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsContent value="overview" className="mt-0 outline-none">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="grievances" className="mt-0 outline-none">
            <GrievanceManagement />
          </TabsContent>

          <TabsContent value="appointments" className="mt-0 outline-none">
            <AppointmentManagement />
          </TabsContent>

          <TabsContent value="users" className="mt-0 outline-none">
            <UserManagementTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
