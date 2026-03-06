"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download } from "lucide-react";
import { User } from "@/lib/api/user";

interface UserListProps {
  users: User[];
  filteredUsers: User[];
  exportToCSV: (data: any[], filename: string) => void;
  setSelectedUserForDetails: (user: User) => void;
  setShowUserDetailsDialog: (open: boolean) => void;
}

export default function UserList({
  users,
  filteredUsers,
  exportToCSV,
  setSelectedUserForDetails,
  setShowUserDetailsDialog,
}: UserListProps) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Team Directory
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(users, "users")}
          className="text-[10px] font-black uppercase tracking-wider"
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sr. No.
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Identity
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Privileges
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u, idx) => (
                <tr
                  key={u._id}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <p className="font-black text-slate-900 leading-none">
                        {u.fullName || `${u.firstName} ${u.lastName}`}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                        {u.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : u.role === "COMPANY_ADMIN"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      }`}
                    >
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        u.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500 anim-pulse" : "bg-slate-400"}`}
                      ></span>
                      {u.isActive ? "Verified" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUserForDetails(u);
                        setShowUserDetailsDialog(true);
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
