'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Shield, Building2, Users, Activity, AlertTriangle, RefreshCw, CreditCard, Server } from 'lucide-react';

interface PlatformOverview {
  tenancy: { totalTenants: number; activeTenants: number; suspendedTenants: number };
  users: { totalUsers: number };
  messaging: { inboundMessages: number; outboundMessages: number; conversations: number; failedJobs: number; queueHealth: any };
  compliance: { uptimeTarget: string; abuseDetection: string; auditTrail: string };
}

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <Icon className="w-5 h-5 text-slate-400" />
    </div>
    <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
  </div>
);

export default function PlatformOverviewPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setFetching(true);
    try {
      setError(null);
      const [overviewRes, healthRes, invoiceRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: PlatformOverview }>('/platform/overview'),
        apiClient.get<{ success: boolean; data: any }>('/platform/monitoring/health'),
        apiClient.get<{ success: boolean; data: any[] }>('/platform/billing/invoices'),
      ]);
      setData(overviewRes.data);
      setHealth(healthRes.data);
      setInvoices(invoiceRes.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load platform overview data.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/dashboard');
      return;
    }
    if (user?.role === 'SUPER_ADMIN') load();
  }, [loading, user]);

  const hasAnyData = Boolean(
    (data?.tenancy.totalTenants ?? 0) > 0 ||
    (data?.users.totalUsers ?? 0) > 0 ||
    (data?.messaging.inboundMessages ?? 0) > 0 ||
    (data?.messaging.outboundMessages ?? 0) > 0 ||
    invoices.length > 0,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">PugArch Platform Control Center</h1>
            <p className="text-slate-600 mt-1">Enterprise WhatsApp Automation & Governance Infrastructure</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white">
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push('/superadmin/dashboard')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Go to Super Admin Dashboard
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Go to Company Layer
          </button>
        </div>


        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!fetching && !error && !hasAnyData && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Platform is reachable but there is no operational data yet. Onboard at least one company, send a WhatsApp message, and generate usage to see live metrics here.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Clients" value={data?.tenancy.totalTenants ?? '-'} icon={Building2} />
          <StatCard label="Active Clients" value={data?.tenancy.activeTenants ?? '-'} icon={Shield} />
          <StatCard label="Total Users" value={data?.users.totalUsers ?? '-'} icon={Users} />
          <StatCard label="Failed Jobs" value={data?.messaging.failedJobs ?? '-'} icon={AlertTriangle} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><Activity className="w-5 h-5"/> Messaging Throughput</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Inbound: <span className="font-semibold">{data?.messaging.inboundMessages ?? 0}</span></p>
              <p>Outbound: <span className="font-semibold">{data?.messaging.outboundMessages ?? 0}</span></p>
              <p>Conversations: <span className="font-semibold">{data?.messaging.conversations ?? 0}</span></p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><Server className="w-5 h-5"/> Monitoring</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Mongo: <span className="font-semibold">{health?.db?.mongoConnected ? 'connected' : 'disconnected'}</span></p>
              <p>Redis: <span className="font-semibold">{health?.db?.redisConnected ? 'connected' : 'disconnected'}</span></p>
              <p>Uptime(sec): <span className="font-semibold">{health?.app?.uptimeSec ?? '-'}</span></p>
              <p>Queue enabled: <span className="font-semibold">{health?.queue?.enabled ? 'yes' : 'no'}</span></p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5"/> Billing Snapshot</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Invoices: <span className="font-semibold">{invoices.length}</span></p>
              <p>Latest status: <span className="font-semibold capitalize">{invoices[0]?.status || 'n/a'}</span></p>
              <p>Latest amount: <span className="font-semibold">{invoices[0]?.totalAmount ?? '-'}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
