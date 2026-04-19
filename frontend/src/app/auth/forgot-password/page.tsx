"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { authAPI } from "@/lib/api/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Please enter your registered phone number");
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({
        phone: phone.trim(),
      });
      toast.success("If your account exists, an OTP has been sent on WhatsApp.");
      router.push(`/auth/reset-password?phone=${encodeURIComponent(phone.trim())}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to process your request right now.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 mb-6 uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Forgot password</h1>
        <p className="text-sm text-slate-500 mt-2">
          Enter your registered phone number to receive your OTP on WhatsApp.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Registered phone number
            </Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="9876543210"
                className="pr-20"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Send OTP via
            </Label>
            <div className="h-10 rounded-xl border border-slate-900 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>
        </form>
      </div>
    </div>
  );
}
