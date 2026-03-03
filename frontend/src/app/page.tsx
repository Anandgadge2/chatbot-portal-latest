'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { validatePhoneNumber, validatePassword, normalizePhoneNumber } from '@/lib/utils/phoneUtils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Shield, TrendingUp, Eye as EyeIcon, EyeOff as EyeOffIcon, ShieldCheck as ShieldCheckIcon, Zap as ZapIcon, Lock as LockIcon } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    if (!authLoading && user) {
      if (user.role === 'SUPER_ADMIN') {
        router.push('/superadmin/dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear previous error
    setError('');
    
    // Validate inputs
    if (!phone.trim()) {
      const msg = 'Please enter your phone number';
      setError(msg);
      toast.error(msg);
      return;
    }

    // Validate phone number - must be exactly 10 digits
    if (!validatePhoneNumber(phone.trim())) {
      const msg = 'Phone number must be exactly 10 digits';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!password.trim()) {
      const msg = 'Please enter your password';
      setError(msg);
      toast.error(msg);
      return;
    }

    // Validate password - must be between 6 and 8 characters
    if (!validatePassword(password.trim())) {
      const msg = 'Password must be between 6 and 8 characters';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    
    try {
      console.log('🔐 Attempting login with:', { phone: phone.trim() });
      await login({ phone: phone.trim(), password: password.trim() });
      console.log('✅ Login successful');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#f8fafc] overflow-hidden selection:bg-indigo-100 relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] lg:w-[800px] h-[600px] lg:h-[800px] bg-indigo-200/20 blur-[80px] lg:blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] bg-sky-200/20 blur-[70px] lg:blur-[100px] rounded-full"></div>

      {/* Left Panel - Branding (Visible on large screens) */}
      <div className="hidden lg:flex lg:w-[40%] flex-col relative overflow-hidden bg-[#0f172a] h-full shadow-[20px_0_50px_rgba(0,0,0,0.1)] z-20">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-30">
           <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_60%,rgba(14,165,233,0.15)_0%,transparent_50%)]"></div>
        </div>
        
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 xl:mb-12 group">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl transition-transform group-hover:scale-110 duration-500">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-black text-white tracking-tighter">Citizen<span className="text-sky-400">Care</span></span>
              <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 mt-0.5"></div>
            </div>
          </div>

          <div className="mt-auto mb-8">
            <h1 className="text-3xl xl:text-4xl font-black text-white leading-[1.1] tracking-tight mb-5">
              Empowering <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 italic font-medium">Digital Republic</span>
            </h1>
            
            <p className="text-sm xl:text-base text-slate-400 max-w-sm leading-relaxed mb-8 font-medium">
              A unified command center for citizen grievances, automated appointments, and real-time response management.
            </p>

            {/* Features Glass Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="group p-4 xl:p-5 rounded-2xl xl:rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 xl:w-11 xl:h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                    <Shield className="w-5 h-5 xl:w-5.5 xl:h-5.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs xl:text-sm">Military-Grade Security</h4>
                    <p className="text-slate-500 text-[11px] xl:text-xs font-medium">End-to-end encrypted citizen data</p>
                  </div>
                </div>
              </div>

              <div className="group p-4 xl:p-5 rounded-2xl xl:rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 xl:w-11 xl:h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 group-hover:bg-sky-50 transition-colors duration-300">
                    <TrendingUp className="w-5 h-5 xl:w-5.5 xl:h-5.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs xl:text-sm">Insightful Analytics</h4>
                    <p className="text-slate-500 text-[11px] xl:text-xs font-medium">Live monitoring and trend analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-0 pt-6 border-t border-white/5 flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
             <span>v1.2.0</span>
             <span>Safe & Encrypted</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[58%] flex flex-col h-full bg-transparent overflow-y-auto lg:overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md lg:max-w-lg">
            <div className="mb-3 xl:mb-4 text-center lg:text-left">
              <h2 className="text-2xl xl:text-3xl font-extrabold text-slate-900 tracking-tight leading-none mb-2 uppercase">Welcome Back</h2>
              <p className="text-slate-500 text-sm xl:text-base font-medium">Log in to manage your administrative dashboard</p>
            </div>

            <div className="relative group">
              {/* Soft Shadow Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-[2rem] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
              
              <Card className="relative bg-white border border-slate-200 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] rounded-[2rem] overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500/40 via-sky-500/40 to-emerald-500/40"></div>
                
                <CardHeader className="pt-5 px-8 xl:px-10 pb-0">
                  <CardTitle className="text-lg xl:text-xl font-black text-slate-800 tracking-tight">Login Portal</CardTitle>
                  <CardDescription className="text-slate-500 text-xs xl:text-sm font-medium">Authorized personnel only</CardDescription>
                </CardHeader>

                <CardContent className="px-8 xl:px-10 py-5">
                  <form onSubmit={handleSubmit} className="space-y-3 xl:space-y-4">
                    <div className="space-y-1.5 xl:space-y-2">
                      <Label htmlFor="phone" className="text-slate-800 font-bold text-xs xl:text-sm uppercase tracking-wider ml-1">Phone Number</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-focus-within:bg-indigo-100 group-focus-within:text-indigo-600 transition-colors">
                              <svg className="h-3.5 w-3.5 xl:h-4 xl:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                           </div>
                        </div>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="000 000 0000"
                          value={phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(value);
                          }}
                          maxLength={10}
                          required
                          disabled={loading}
                          className="pl-16 h-11 xl:h-12 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/20 rounded-2xl text-slate-900 placeholder:text-slate-400 text-base xl:text-lg font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 xl:space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label htmlFor="password" className="text-slate-800 font-bold text-xs xl:text-sm uppercase tracking-wider">Password</Label>
                        <button type="button" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors">Forgot?</button>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-focus-within:bg-indigo-100 group-focus-within:text-indigo-600 transition-colors">
                            <svg className="h-3.5 w-3.5 xl:h-4 xl:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </div>
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          minLength={6}
                          maxLength={8}
                          required
                          disabled={loading}
                          className="pl-16 pr-14 h-11 xl:h-12 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 bg-slate-50/20 rounded-2xl text-slate-900 placeholder:text-slate-400 text-base xl:text-lg font-medium transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOffIcon className="h-4 w-4 xl:h-5 xl:w-5" />
                          ) : (
                            <EyeIcon className="h-4 w-4 xl:h-5 xl:w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        className="w-full h-11 xl:h-12 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all text-base xl:text-lg group"
                        disabled={loading}
                      >
                        {loading ? (
                          <span className="flex items-center gap-3">
                            <LoadingSpinner className="!w-4 !h-4 xl:!w-5 xl:!h-5 !text-white" />
                            Verifying...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Sign In to Command Center
                            <svg className="w-4 h-4 xl:w-5 xl:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>

                  <div className="mt-4 xl:mt-5 mb-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-100"></div>
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-300">Security Verified</span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>

                  <div className="flex items-center justify-center gap-4 xl:gap-6">
                    <div className="flex flex-col items-center gap-1 group cursor-help">
                      <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors border border-slate-100">
                        <ShieldCheckIcon className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-500" />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">AES-256</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 group cursor-help">
                      <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors border border-slate-100">
                        <LockIcon className="w-4 h-4 xl:w-5 xl:h-5 text-indigo-500" />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">SSL Secure</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 group cursor-help">
                      <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-sky-50 transition-colors border border-slate-100">
                        <ZapIcon className="w-4 h-4 xl:w-5 xl:h-5 text-sky-500" />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Optimized</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="mt-6 text-center text-slate-400 text-sm font-medium">
               Don&apos;t have an account? <button className="text-indigo-600 font-bold hover:underline">Contact System Admin</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
