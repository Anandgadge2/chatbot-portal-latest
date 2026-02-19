'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  Activity, 
  UserPlus, 
  FileText, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight, 
  User, 
  Settings, 
  RefreshCw,
  Building,
  Key,
  ShieldCheck,
  ChevronRight,
  Database
} from 'lucide-react';

interface AuditLog {
  _id: string;
  userId: any;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: any;
  ipAddress: string;
  createdAt: string;
}

export default function RecentActivityPanel({ companyId }: { companyId?: string }) {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRecentActivities();
  }, [companyId]);

  const fetchRecentActivities = async () => {
    try {
      if (!loadingActivities) setRefreshing(true);
      const url = companyId ? `/audit?limit=20&companyId=${companyId}` : '/audit?limit=20';
      const response = await apiClient.get(url);
      if (response.success) {
        const logs = response.data.logs.map((log: any) => ({
          ...log,
          createdAt: log.timestamp,
          resourceType: log.resource,
          changes: log.details
        }));
        setActivities(logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoadingActivities(false);
      setRefreshing(false);
    }
  };

  const getActivityIcon = (action: string, resourceType: string) => {
    switch (action) {
      case 'CREATE':
        if (resourceType === 'User') return <UserPlus className="w-3.5 h-3.5 text-emerald-600" />;
        if (resourceType === 'Company') return <Building className="w-3.5 h-3.5 text-blue-600" />;
        if (resourceType === 'Department') return <Database className="w-3.5 h-3.5 text-purple-600" />;
        return <Activity className="w-3.5 h-3.5 text-slate-600" />;
      case 'UPDATE': return <Clock className="w-3.5 h-3.5 text-amber-600" />;
      case 'DELETE': return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
      case 'LOGIN': return <Key className="w-3.5 h-3.5 text-cyan-600" />;
      default: return <Activity className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getScheme = (action: string) => {
    switch (action) {
      case 'CREATE': return { color: 'emerald', bg: 'bg-emerald-500' };
      case 'UPDATE': return { color: 'amber', bg: 'bg-amber-500' };
      case 'DELETE': return { color: 'rose', bg: 'bg-rose-500' };
      case 'LOGIN': return { color: 'cyan', bg: 'bg-cyan-500' };
      default: return { color: 'slate', bg: 'bg-slate-500' };
    }
  };

  const getLogSummary = (log: AuditLog) => {
    const userName = typeof log.userId === 'object' && log.userId 
      ? `${log.userId.firstName} ${log.userId.lastName}`
      : 'System';
    
    return {
      user: userName,
      action: log.action,
      resource: log.resourceType,
      time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(log.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })
    };
  };

  if (loadingActivities) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/4 mb-8"></div>
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                <div className="h-3 bg-slate-50 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">System Audit Log</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Real-time Stream</span>
            </div>
          </div>
        </div>
        <button 
          onClick={fetchRecentActivities}
          disabled={refreshing}
          className="p-2.5 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 rounded-xl transition-all group"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-blue-600 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto max-h-[640px] p-6 relative scrollbar-thin scrollbar-thumb-slate-200">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-400">No activity recorded</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

            <div className="space-y-8">
              {activities.map((log, idx) => {
                const summary = getLogSummary(log);
                const scheme = getScheme(log.action);
                
                return (
                  <div key={log._id} className="relative pl-10 group">
                    {/* Timeline Node */}
                    <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-4 border-white shadow-sm z-10 ${scheme.bg} flex items-center justify-center`}>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                    </div>

                    {/* Content Card */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-black text-slate-900 leading-none">{summary.user}</span>
                           <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase">
                             {idx === 0 ? 'Latest' : summary.date}
                           </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{summary.time}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border shadow-sm ${
                          log.action === 'CREATE' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          log.action === 'UPDATE' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                          log.action === 'DELETE' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                          'bg-slate-50 border-slate-100 text-slate-700'
                        }`}>
                          {getActivityIcon(log.action, log.resourceType)}
                          <span className="text-[10px] font-black uppercase tracking-wider">{log.action === 'CREATE' ? 'Proceed' : log.action}</span>
                        </div>
                        
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                           <span className="text-[10px] font-bold text-slate-600">{log.resourceType}</span>
                        </div>
                      </div>

                      {/* Detail Expansion */}
                      <div className="mt-3 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 group-hover:bg-slate-50 group-hover:border-slate-200 transition-all">
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          {log.changes?.description || `${summary.action} entry in ${log.resourceType} module`}
                        </p>
                        
                        {/* Nested Procedure Details */}
                        {log.changes?.updates && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 space-y-1.5">
                            {Object.entries(log.changes.updates).map(([key, val]: [string, any]) => (
                              <div key={key} className="flex items-center gap-2 text-[10px]">
                                <span className="font-bold text-slate-400 lowercase">{key}:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-700">{String(val).length > 30 ? String(val).substring(0, 30) + '...' : String(val)}</span>
                                  <ArrowRight className="w-2.5 h-2.5 text-blue-400" />
                                  <span className="px-1 bg-blue-50 text-blue-600 rounded-sm font-black">Applied</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-slate-300 font-mono tracking-tighter">ID: {log.resourceId?.substring(0, 8)}...</span>
                            {log.ipAddress && (
                              <span className="text-[9px] font-bold text-slate-300 flex items-center gap-1 uppercase">
                                <Settings className="w-2 h-2" />
                                {log.ipAddress}
                              </span>
                            )}
                          </div>
                          <div className="w-4 h-4 bg-white border border-slate-100 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-2.5 h-2.5 text-slate-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End of Stream • 20 Events</span>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
        </div>
      </div>
    </div>
  );
}
