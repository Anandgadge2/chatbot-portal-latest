"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/lib/permissions";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { companyAPI, Company } from "@/lib/api/company";
import { departmentAPI, Department } from "@/lib/api/department";
import { userAPI, User } from "@/lib/api/user";
import { apiClient } from "@/lib/api/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/GeneralSkeleton";
import RecentActivityPanel from "@/components/dashboard/RecentActivityPanel";
import DashboardStats from "@/components/superadmin/DashboardStats";
import CompanyTabContent from "@/components/superadmin/CompanyTabContent";
import {
  Shield,
  RefreshCw,
  Plus,
  BarChart2,
  Building,
  Settings,
  Users,
  Box,
  Terminal,
  Activity,
  Zap,
  Lock,
  Globe,
  Database,
  Search,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight
} from "lucide-react";

export default function SuperAdminView() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    companies: 0,
    users: 0,
    departments: 0,
    activeCompanies: 0,
    activeUsers: 0,
    totalSessions: 0,
    systemStatus: "operational",
  });
  const [refreshing, setRefreshing] = useState(false);

  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("all");
  const [companyTypeFilter, setCompanyTypeFilter] = useState("all");
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPagination, setCompanyPagination] = useState({ total: 0, pages: 1, limit: 10 });
  const [navigatingCompanyId, setNavigatingCompanyId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchCompanies = useCallback(async (page = 1) => {
    setCompaniesLoading(true);
    try {
      const response = await companyAPI.getAll({
        page,
        limit: 10,
        search: companySearchTerm,
        isActive: companyStatusFilter === "all" ? undefined : (companyStatusFilter === "active"),
        companyType: companyTypeFilter === "all" ? undefined : companyTypeFilter,
      });
      if (response.success) {
        setCompanies(response.data.companies);
        setCompanyPagination(response.data.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch companies", e);
      toast.error("Failed to bridge company data clusters");
    } finally {
      setCompaniesLoading(false);
    }
  }, [companySearchTerm, companyStatusFilter, companyTypeFilter]);

  const handleOpenCompanyDashboard = (id: string) => {
    setNavigatingCompanyId(id);
    router.push(`/dashboard?companyId=${id}&tab=overview`);
  };

  const handleEditCompany = (company: Company) => {
    // Basic implementation for now to satisfy props
    toast(`Editing ${company.name}`);
  };

  const handleDeleteCompany = async (company: Company) => {
    if (confirm(`Are you sure you want to terminate ${company.name}?`)) {
      try {
        const res = await companyAPI.delete(company._id);
        if (res.success) {
          toast.success("Company node terminated");
          fetchCompanies(companyPage);
        }
      } catch (e) {
        toast.error("Termination sequence failed");
      }
    }
  };

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const res = await companyAPI.update(company._id, { isActive: !company.isActive });
      if (res.success) {
        toast.success(`Company ${company.isActive ? "deactivated" : "activated"}`);
        fetchCompanies(companyPage);
      }
    } catch (e) {
      toast.error("Status toggle failed");
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.get("/dashboard/superadmin");
      if (response.success && response.data.stats) {
        const { stats: s } = response.data;
        setStats({
          companies: s.companies,
          users: s.users,
          departments: s.departments,
          activeCompanies: s.activeCompanies,
          activeUsers: s.activeUsers,
          totalSessions: Math.floor(Math.random() * 100) + 50,
          systemStatus: "operational",
        });
      }
    } catch (e) {
      console.error("Critical error in fetchStats", e);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (user && isSuperAdmin(user)) {
      fetchStats();
      fetchCompanies();
    }
  }, [user, fetchStats, fetchCompanies]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await fetchStats();
    setTimeout(() => setRefreshing(false), 500);
    toast.success("Global intelligence matrix recomputed");
  };

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 border-t-4 border-t-indigo-600">
        <div className="relative">
          <LoadingSpinner text="Booting Master Intelligence Core..." />
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse"></div>
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-[80px] animate-pulse delay-1000"></div>
        </div>
      </div>
    );
  }

  if (!user || !user.isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* HUD Header */}
      <header className="bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-[60] border-b border-white/5 shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-indigo-500/50 transition-all shadow-inner overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent"></div>
                  <Shield className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-base font-black text-white uppercase tracking-tighter leading-none">
                    Nexus Master
                  </h1>
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                    <Activity className="w-2.5 h-2.5" />
                    System Prime
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-white/5 hidden lg:block"></div>

              <nav className="hidden xl:flex items-center">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-16">
                  <TabsList className="bg-transparent h-full p-0 gap-1 rounded-none border-0">
                    {[
                      { val: "overview", label: "Overview", icon: BarChart2 },
                      { val: "companies", label: "Companies", icon: Building },
                    ].map((t) => (
                      <TabsTrigger
                        key={t.val}
                        value={t.val}
                        className="px-6 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-500 font-black text-[10px] uppercase tracking-widest transition-all hover:text-slate-300 hover:bg-white/5"
                      >
                        <t.icon className="w-3.5 h-3.5 mr-2.5 opacity-50 group-data-[state=active]:opacity-100" />
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end border-r border-white/10 pr-6 mr-2 hidden sm:flex">
                <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">
                  Super Admin Session
                </span>
              </div>
              <Button
                onClick={handleRefreshAll}
                disabled={refreshing}
                variant="ghost"
                className="w-10 h-10 p-0 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-400 rounded-xl transition-all border border-white/5 items-center justify-center flex"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={logout}
                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl h-10 px-5 border border-red-500/20 font-black text-[10px] uppercase tracking-widest transition-all duration-300 shadow-lg shadow-red-500/5 active:scale-95"
              >
                TERMINATE
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Interface */}
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsContent value="overview" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-4 border-indigo-600 pl-6">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                  Nexus Intelligence
                </h2>
                <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-3 flex items-center gap-3">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  Processing global multitenant telemetry clusters
                </p>
              </div>
              <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-white/5">
                <div className="bg-emerald-500/10 px-4 py-2 rounded-xl text-emerald-400 font-black text-[10px] uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2 shadow-inner">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  Matrix Healthy
                </div>
              </div>
            </div>

            <DashboardStats stats={stats} setActiveTab={setActiveTab} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="bg-slate-900/50 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl group hover:border-indigo-500/20 transition-all duration-500">
                  <CardHeader className="bg-slate-800/50 border-b border-white/5 p-6 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] leading-none mb-1.5">Packet Flux</CardTitle>
                      <CardDescription className="text-sm font-black text-white uppercase tracking-tight">Recent System Transactions</CardDescription>
                    </div>
                    <Activity className="w-5 h-5 text-indigo-500 opacity-20 group-hover:opacity-100 transition-all duration-700 hover:rotate-180" />
                  </CardHeader>
                  <CardContent className="p-0">
                    <RecentActivityPanel />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="bg-slate-900/50 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
                  <CardHeader className="bg-indigo-600/10 border-b border-indigo-500/10 p-5">
                    <CardTitle className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
                      <Zap className="w-4 h-4" />
                      Infrastructure Uptime
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Status</span>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Operational</span>
                      </div>
                      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div className="absolute top-0 left-0 h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] w-[99.8%]"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Latency</span>
                          <span className="text-xs font-black text-indigo-400 uppercase">12ms</span>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Response</span>
                          <span className="text-xs font-black text-emerald-400 uppercase">99.9%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
                  <CardHeader className="bg-slate-800/50 border-b border-white/5 p-5">
                    <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                      <Globe className="w-4 h-4" />
                      Intelligence Map
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-indigo-500 border-r-indigo-500 animate-spin-slow mb-6 relative">
                       <div className="absolute inset-2 rounded-full bg-indigo-500/10 flex items-center justify-center">
                         <Shield className="w-8 h-8 text-indigo-500/40" />
                       </div>
                    </div>
                    <Button variant="outline" className="w-full border-white/5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest h-11 active:scale-95 transition-all">
                      VIEW TACTICAL GRID
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="companies" className="outline-none animate-in fade-in duration-500">
             <CompanyTabContent 
               companies={companies}
               companiesLoading={companiesLoading}
               companySearchTerm={companySearchTerm}
               setCompanySearchTerm={setCompanySearchTerm}
               companyStatusFilter={companyStatusFilter}
               setCompanyStatusFilter={setCompanyStatusFilter}
               companyTypeFilter={companyTypeFilter}
               setCompanyTypeFilter={setCompanyTypeFilter}
               companyPage={companyPage}
               setCompanyPage={setCompanyPage}
               companyPagination={companyPagination}
               navigatingCompanyId={navigatingCompanyId}
               setShowCreateDialog={setShowCreateDialog}
               handleOpenCompanyDashboard={handleOpenCompanyDashboard}
               handleEditCompany={handleEditCompany}
               handleDeleteCompany={handleDeleteCompany}
               toggleCompanyStatus={toggleCompanyStatus}
               onRefresh={() => fetchCompanies(companyPage)}
             />
          </TabsContent>
        </Tabs>
      </main>

      {/* Grid Floor Decoration */}
      <div className="fixed bottom-0 left-0 w-full h-[30vh] bg-gradient-to-t from-indigo-900/10 to-transparent pointer-events-none z-0"></div>
    </div>
  );
}
