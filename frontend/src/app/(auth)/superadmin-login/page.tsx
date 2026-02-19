'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { Shield, Lock, Mail, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden selection:bg-blue-600/10">
      {/* Abstract Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-100 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-100 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md px-4 relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight uppercase">Platform<span className="text-blue-600">OS</span></h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">SuperAdmin Node</p>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-2xl shadow-blue-500/5 rounded-2xl overflow-hidden border-0">
          <CardHeader className="space-y-1 pb-4 pt-8 text-center bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight uppercase">Restricted Access</CardTitle>
            <CardDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Verify your credentials to proceed</CardDescription>
          </CardHeader>
          
          <CardContent className="pt-8 px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Terminal</Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@platform.os"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 font-bold text-sm rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Key</Label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 font-bold text-sm rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white font-black h-12 rounded-xl transition-all shadow-xl shadow-slate-200 gap-3 group mt-4 overflow-hidden"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                ) : (
                  <>
                    <span className="uppercase tracking-widest text-[11px]">Authorize System Entry</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
              <button 
                onClick={() => router.push('/')}
                className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest flex items-center gap-2 transition-colors duration-200"
              >
                <ArrowLeft className="w-3 h-3" />
                Return to Core Home
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="mt-8 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
          Powered by PLATFORM<span className="text-blue-600">OS</span> Core Systems
        </p>
      </div>
    </div>
  );
}
