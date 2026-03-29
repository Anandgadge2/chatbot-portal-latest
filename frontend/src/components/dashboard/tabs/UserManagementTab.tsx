"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import { userAPI, User } from "@/lib/api/user";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Shield, 
  ShieldAlert, 
  ChevronRight, 
  LogOut,
  Mail,
  Smartphone,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Key,
  Database,
  ShieldCheck,
  Inbox,
  RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface UserManagementTabProps {
  companyId?: string;
}

export default function UserManagementTab({ companyId: propCompanyId }: UserManagementTabProps) {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  
  // Scoping logic: 
  // 1. Use prop companyId 
  // 2. Use companyId from URL (for SuperAdmins in drilldown)
  // 3. Fall back to current user's companyId
  const effectiveCompanyId = useMemo(() => {
    if (propCompanyId) return propCompanyId;
    if (currentUser?.role === 'SUPER_ADMIN') {
      const urlCompanyId = searchParams?.get('companyId');
      if (urlCompanyId) return urlCompanyId;
    }
    return currentUser?.companyId ? (typeof currentUser.companyId === 'object' ? (currentUser.companyId as any)._id : currentUser.companyId) : "";
  }, [propCompanyId, currentUser, searchParams]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [customRoles, setCustomRoles] = useState<any[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userAPI.getAll({ 
        limit: 100, 
        role: roleFilter || undefined,
        companyId: effectiveCompanyId || undefined
      });
      if (res.success) {
        setUsers(res.data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error("Personnel manifest synchronization failed");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, effectiveCompanyId]);

  const fetchCustomRoles = useCallback(async () => {
    // If SuperAdmin but no company selected, fetch ALL roles for the global dropdown
    const isAdminView = currentUser?.role === 'SUPER_ADMIN' && !effectiveCompanyId;
    
    if (!effectiveCompanyId && !isAdminView) return;
    
    try {
      const { roleAPI } = await import("@/lib/api/role");
      // If we are in global view, passing undefined/empty string to getRoles() will hit /roles endpoint
      const res = await roleAPI.getRoles(effectiveCompanyId || "");
      if (res.success) {
        // Filter out level 0 roles (Platform Superadmin) for company-level management
        // but keep them all for SuperAdmin global view if they want to filter across roles
        const filteredRoles = (res.data.roles || []).filter((r: any) => isAdminView || r.level > 0);
        setCustomRoles(filteredRoles);
      }
    } catch (error) {
      console.error("Failed to fetch custom roles", error);
    }
  }, [effectiveCompanyId, currentUser]);

  useEffect(() => {
    fetchUsers();
    fetchCustomRoles();
  }, [fetchUsers, fetchCustomRoles]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super-admin": return "bg-slate-900 shadow-slate-900/10 border-slate-700 text-white shadow-xl";
      case "company-admin": return "bg-indigo-600 shadow-indigo-600/10 border-indigo-400 text-white";
      case "department-admin": return "bg-blue-500 shadow-blue-500/10 border-blue-300 text-white";
      default: return "bg-slate-100 border-slate-200 text-slate-600 shadow-none";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
            Personnel Directory
          </h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1 flex items-center gap-2">
            <Database className="w-3 h-3 text-indigo-500" />
            Managing System Agents & Operational Roles
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 font-bold text-xs uppercase tracking-wider h-10 shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
            <UserPlus className="w-4 h-4 mr-2" />
            Provision New Agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <Card className="border-slate-200 shadow-xl shadow-slate-200/50 bg-white/50 backdrop-blur-xl border-t-4 border-t-indigo-500 overflow-hidden">
            <CardHeader className="bg-white/80 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Filter by Agent Name, ID, or Signature..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                />
              </div>
              <div className="flex items-center gap-3">
                <select 
                  className="h-10 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer appearance-none relative" 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.75rem' }}
                >
                  <option value="">All Tiers</option>
                  {customRoles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                  {currentUser?.role === 'SUPER_ADMIN' && !effectiveCompanyId && <option value="SUPER_ADMIN">System Core (SA)</option>}
                </select>
                <Button variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[9px] shadow-sm bg-white border-slate-200 hover:bg-slate-50">
                  <Key className="w-3.5 h-3.5 mr-2" />
                  Security Protocols
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clearance Level</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                      <tr key={u._id} className="group border-b border-slate-50/50 hover:bg-indigo-50/20 transition-all duration-300 active:bg-indigo-50/40">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-black text-white shadow-lg text-sm border-2 border-white">
                                {u.firstName[0]}{u.lastName[0]}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${u.isActive ? "bg-emerald-500" : "bg-red-500"}`}>
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-slow"></div>
                              </div>
                            </div>
                            <div className="flex flex-col justify-center">
                              <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5 group-hover:text-indigo-600 transition-colors">
                                {u.firstName} {u.lastName}
                              </span>
                              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span className="text-slate-400">ID: {u.userId}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-shadow group-hover:shadow-md ${getRoleBadge(u.role || '')}`}>
                            {u.customRoleId && typeof u.customRoleId === 'object' ? (u.customRoleId as any).name : (u.role || 'GUEST')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                            {u.departmentId ? (typeof u.departmentId === 'object' ? (u.departmentId as any).name : 'Restricted Sector') : 'Global Sector'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {u.isActive ? (
                            <div className="flex items-center gap-2 text-emerald-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Authenticated</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-500">
                              <XCircle className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Revoked</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-white border border-slate-200 shadow-sm hover:scale-105 transition-transform">
                              <ShieldAlert className="w-4 h-4 text-slate-400 group-hover:text-yellow-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-white border border-slate-200 shadow-sm hover:scale-105 transition-transform">
                              <ChevronRight className="w-4 h-4 text-indigo-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                          {loading ? <LoadingSpinner text="Synchronizing Databases..." /> : (
                            <div className="flex flex-col items-center justify-center opacity-40">
                              <Users className="w-16 h-16 text-slate-300 mb-6" />
                              <span className="text-lg font-black text-slate-900 uppercase tracking-tighter">Zero Agents Detected</span>
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Check security credentials or adjust retrieval parameters</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
