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
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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
      const msg = "Phone number must be exactly 10 digits";
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
      const msg = "Password must be between 6 and 8 characters";
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-slate-50">
      {/* ── LEFT PANEL — Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative bg-[#0b1120] overflow-hidden">
        {/* Radial gradient overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.25)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_75%,rgba(14,165,233,0.18)_0%,transparent_55%)]" />
        {/* Grid / dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-12 xl:p-20">
          {/* Logo */}
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 transition-all group-hover:scale-110 duration-500 group-hover:rotate-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <span className="text-3xl font-black text-white tracking-tighter leading-none block mb-1">
                Citizen<span className="text-sky-400">Care</span>
              </span>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">
                Admin Command Center
              </p>
            </div>
          </div>

          {/* Hero Copy */}
          <div className="mt-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8 backdrop-blur-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                Active
              </span>
            </div>
            <h1 className="text-4xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Empowering <br />
              <span className="italic font-medium text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">
                Digital Republic
              </span>
            </h1>
            <p className="text-slate-400 text-base xl:text-lg leading-relaxed max-w-md font-medium">
              A unified command center for citizen grievances, automated
              appointments, and real-time response management.
            </p>
          </div>

          {/* Feature Cards - Interactive Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-12">
            {[
              {
                icon: <Shield className="w-4 h-4" />,
                color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                title: "Military Security",
                sub: "AES-256 encrypted records",
              },
              {
                icon: <TrendingUp className="w-4 h-4" />,
                color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                title: "Insight Analytics",
                sub: "Real-time monitoring",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-300 backdrop-blur-sm group cursor-pointer hover:border-white/10"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.color} group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-tight">{item.title}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
            <span>Build Version 1.2.0</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><LockIcon className="w-3 h-3" /> Encrypted</span>
              <span className="flex items-center gap-1.5"><ShieldCheckIcon className="w-3 h-3" /> Certified</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 overflow-y-auto">
        {/* Subtle background flourishes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-100/30 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-[460px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Mobile Heading */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-10 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl border border-slate-800">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                Citizen<span className="text-indigo-600">Care</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
                Admin Command Center
              </p>
            </div>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase bg-clip-text">
              Authentication
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-2 flex items-center justify-center lg:justify-start gap-2">
              <span className="w-5 h-[1px] bg-slate-200 hidden lg:block" />
              Secure entry for authorized personnel
            </p>
          </div>

          {/* Login Card */}
          <div className="relative group">
            {/* Soft shadow glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-[32px] blur-xl opacity-20 group-hover:opacity-30 transition-all duration-1000" />
            
            <div className="relative bg-white border border-slate-200 rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.1)] overflow-hidden">
              {/* Card Title Tab */}
              <div className="absolute top-0 left-0 bg-slate-900 px-6 py-2 rounded-br-2xl flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest whitespace-nowrap">Secure Gateway</span>
              </div>

              <form onSubmit={handleSubmit} className="p-10 pt-16 space-y-7">
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 font-bold animate-in zoom-in-95 duration-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Phone Number Field */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <Label htmlFor="phone" className="text-slate-900 font-black text-[10px] uppercase tracking-widest leading-none">
                      Phone Number
                    </Label>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Required</span>
                  </div>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-focus-within/input:text-indigo-600 group-focus-within/input:bg-indigo-50 group-focus-within/input:border-indigo-100 transition-all">
                        <Phone className="w-4 h-4" />
                      </div>
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit mobile"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      required
                      className="pl-16 h-14 border-slate-200 focus:border-indigo-600 focus:ring-0 bg-slate-50/50 rounded-2xl text-slate-900 placeholder:text-slate-400 font-black text-sm tracking-widest transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <Label htmlFor="password" className="text-slate-900 font-black text-[10px] uppercase tracking-widest leading-none">
                      Password Key
                    </Label>
                    <button type="button" className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors">
                      Recovery?
                    </button>
                  </div>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-focus-within/input:text-indigo-600 group-focus-within/input:bg-indigo-100 group-focus-within/input:border-indigo-200 transition-all">
                        <LockIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      maxLength={8}
                      required
                      className="pl-16 pr-14 h-14 border-slate-200 focus:border-indigo-600 focus:ring-0 bg-slate-50/50 rounded-2xl text-slate-900 placeholder:text-slate-400 font-bold text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all text-xs uppercase tracking-[0.2em] relative overflow-hidden group/btn"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <LoadingSpinner className="!w-4 !h-4 !text-white" />
                        <span>Validating Credentials...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <span>Access Dashboard</span>
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1.5 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>

                {/* Trust Badges */}
                <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                   <div className="flex flex-col items-center gap-1">
                      <ShieldCheckIcon className="w-5 h-5 text-indigo-600" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Verified</span>
                   </div>
                   <div className="flex flex-col items-center gap-1">
                      <ZapIcon className="w-5 h-5 text-sky-500" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Fast v1.2</span>
                   </div>
                </div>
              </form>
            </div>
          </div>

          <p className="mt-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            Authorized Personnel Only <br />
          </p>
        </div>
      </div>
    </div>
  );
}
