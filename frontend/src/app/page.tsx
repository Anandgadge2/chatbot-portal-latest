"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import {
  validatePhoneNumber,
  validatePassword,
} from "@/lib/utils/phoneUtils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  Shield,
  TrendingUp,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  ShieldCheck as ShieldCheckIcon,
  Zap as ZapIcon,
  Lock as LockIcon,
  Phone,
  ArrowRight,
  AlertCircle,
  Activity,
  BadgeCheck,
  Clock3,
} from "lucide-react";

const platformHighlights = [
  {
    icon: Shield,
    title: "Trusted Security",
    sub: "AES-256 encryption and role-based access protection.",
  },
  {
    icon: TrendingUp,
    title: "Operations Visibility",
    sub: "Live grievance, appointment, and team performance insights.",
  },
  {
    icon: Clock3,
    title: "Faster Response Cycles",
    sub: "Keep case routing and citizen follow-ups moving without delay.",
  },
];

const quickStats = [
  { label: "Security posture", value: "Active" },
  { label: "Response tracking", value: "Live" },
  { label: "Version", value: "v1.2.0" },
];

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "SUPER_ADMIN") {
        router.push("/superadmin/dashboard");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");

    if (!phone.trim()) {
      const msg = "Please enter your phone number";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!validatePhoneNumber(phone.trim())) {
      const msg = "Phone number must be 10 or 12 digits (with country code)";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!password.trim()) {
      const msg = "Please enter your password";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!validatePassword(password.trim())) {
      const msg = "Password must be at least 6 characters";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      await login({ phone: phone.trim(), password: password.trim() });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_55%,#111827_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_120px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative flex flex-col justify-between overflow-hidden border-b border-white/10 px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[calc(100vh-3rem)] lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(129,140,248,0.22),transparent_25%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.16),transparent_28%)]" />

            <div className="relative space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-2xl shadow-sky-500/20">
                    <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                      Citizen<span className="text-sky-400">Helpdesk</span>
                    </p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Admin Command Center
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
                  Platform Active
                </div>
              </div>

              <div className="max-w-2xl space-y-6 pt-6 lg:pt-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
                  <BadgeCheck className="h-4 w-4 text-sky-400" />
                  Secure civic operations workspace
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl xl:text-6xl">
                    Modern control center for citizen service teams.
                  </h1>
                  <p className="max-w-xl text-base font-medium leading-8 text-slate-300 sm:text-lg">
                    Manage grievances, appointments, escalation workflows, and frontline response from one clear and reliable dashboard.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {quickStats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-inner shadow-black/10"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-2 text-lg font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mt-10 grid gap-4 xl:grid-cols-3">
              {platformHighlights.map(({ icon: Icon, title, sub }) => (
                <div
                  key={title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:border-sky-400/20 hover:bg-white/[0.08]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/60 text-sky-300 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-white">
                    {title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{sub}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_35%)]" />
            <div className="relative w-full max-w-[460px] rounded-[32px] border border-white/60 bg-white px-5 py-6 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:px-8 sm:py-8">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-white shadow-lg shadow-slate-900/15">
                    <Activity className="h-3.5 w-3.5 text-sky-400" />
                    Secure gateway
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Sign in
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Use your registered mobile number and password to access the admin workspace.
                  </p>
                </div>
                <div className="hidden rounded-2xl bg-slate-100 p-3 text-slate-500 sm:block">
                  <ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span className="font-medium leading-6">{error}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  <Label
                    htmlFor="phone"
                    className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-700"
                  >
                    Phone Number
                  </Label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-focus-within:border-sky-200 group-focus-within:bg-sky-50 group-focus-within:text-sky-600">
                        <Phone className="h-4 w-4" />
                      </div>
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      maxLength={12}
                      required
                      className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-16 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="password"
                      className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-700"
                    >
                      Password
                    </Label>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Minimum 6 characters
                    </span>
                  </div>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-focus-within:border-sky-200 group-focus-within:bg-sky-50 group-focus-within:text-sky-600">
                        <LockIcon className="h-4 w-4" />
                      </div>
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      maxLength={128}
                      required
                      className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-16 pr-14 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-sky-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-14 w-full rounded-2xl bg-slate-950 text-xs font-black uppercase tracking-[0.24em] text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition-all hover:bg-slate-900 active:scale-[0.99]"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner className="!h-4 !w-4 !text-white" />
                      <span>Validating credentials</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span>Access Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-500 shadow-sm">
                    <ShieldCheckIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Verified access</p>
                    <p className="text-xs">Protected administrative sign-in.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sky-500 shadow-sm">
                    <ZapIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Fast onboarding</p>
                    <p className="text-xs">Get into your workspace without clutter.</p>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-center text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                Authorized personnel only
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
