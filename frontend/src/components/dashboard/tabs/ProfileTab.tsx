"use client";

import { Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designations: string;
};

type PasswordFormState = {
  newPassword: string;
  confirmPassword: string;
};

type ProfileTabProps = {
  user: any;
  profileForm: ProfileFormState;
  passwordForm: PasswordFormState;
  updatingProfile: boolean;
  updatingPassword: boolean;
  onProfileSubmit: (e: React.FormEvent) => void;
  onPasswordSubmit: (e: React.FormEvent) => void;
  setProfileForm: (value: ProfileFormState) => void;
  setPasswordForm: (value: PasswordFormState) => void;
};

export function ProfileTab({
  user,
  profileForm,
  passwordForm,
  updatingProfile,
  updatingPassword,
  onProfileSubmit,
  onPasswordSubmit,
  setProfileForm,
  setPasswordForm,
}: ProfileTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-200">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Personal Information
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                  Update your account details and contact information
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={onProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        firstName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        lastName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                    Designations (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={profileForm.designations}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        designations: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Senior Manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    required
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={updatingProfile}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70"
                >
                  {updatingProfile ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-md font-black uppercase tracking-tight text-slate-900">
                  Security
                </CardTitle>
                <CardDescription className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">
                  Update your account password
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={onPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none"
                  placeholder="********"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none"
                  placeholder="********"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={updatingPassword}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:opacity-70"
              >
                {updatingPassword ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    Security Patching...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100/50">
              <div className="flex gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                  Changing your password will require you to log in again on all
                  other devices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
