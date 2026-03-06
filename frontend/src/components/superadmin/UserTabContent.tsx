import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { User } from "@/lib/api/user";
import { Company } from "@/lib/api/company";

interface UserTabContentProps {
  users: User[];
  userSearchTerm: string;
  setUserSearchTerm: (val: string) => void;
  userCompanyFilter: string;
  setUserCompanyFilter: (val: string) => void;
  userRoleFilter: string;
  setUserRoleFilter: (val: string) => void;
  allCompanies: Company[];
  userPage: number;
  setUserPage: (val: number) => void;
  userPagination: { total: number; pages: number; limit: number };
  visiblePasswords: string[];
  togglePasswordVisibility: (id: string) => void;
  setShowUserDialog: (val: boolean) => void;
  setEditingUser: (u: User | null) => void;
  handleEditUser: (u: User) => void;
  handleDeleteUser: (u: User) => void;
  toggleUserStatus: (u: User) => void;
}

const UserTabContent: React.FC<UserTabContentProps> = ({
  users,
  userSearchTerm,
  setUserSearchTerm,
  userCompanyFilter,
  setUserCompanyFilter,
  userRoleFilter,
  setUserRoleFilter,
  allCompanies,
  userPage,
  setUserPage,
  userPagination,
  visiblePasswords,
  togglePasswordVisibility,
  setShowUserDialog,
  setEditingUser,
  handleEditUser,
  handleDeleteUser,
  toggleUserStatus,
}) => {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 border-0 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
              <Users className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">
                Platform Users
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">
                Access control and identity management
              </CardDescription>
            </div>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
            onClick={() => {
              setEditingUser(null);
              setShowUserDialog(true);
            }}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Find user by name or ID..."
              value={userSearchTerm}
              onChange={(e) => {
                setUserSearchTerm(e.target.value);
                setUserPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Company
            </span>
            <select
              value={userCompanyFilter}
              onChange={(e) => {
                setUserCompanyFilter(e.target.value);
                setUserPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[120px]"
            >
              <option value="">All Companies</option>
              {allCompanies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Role
            </span>
            <select
              value={userRoleFilter}
              onChange={(e) => {
                setUserRoleFilter(e.target.value);
                setUserPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[120px]"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="COMPANY_ADMIN">Company Admin</option>
              <option value="DEPARTMENT_ADMIN">Department Admin</option>
              <option value="OPERATOR">Operator</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>
                {userRoleFilter
                  ? `No users with role ${userRoleFilter}.`
                  : "No users yet. Add users or ensure you have Company Admins and other roles."}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#fcfdfe] border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    #
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    User
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Email
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Credentials
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Role
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Company
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((u, idx) => (
                  <tr
                    key={u._id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-3 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-400">
                        {(userPage - 1) * userPagination.limit + idx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold bg-indigo-600 text-[11px] shadow-md shadow-indigo-100">
                          {u.firstName?.[0] || ""}
                          {u.lastName?.[0] || ""}
                        </div>
                        <div className="ml-3">
                          <div className="text-[11px] font-bold text-slate-800 leading-none">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                            {u.userId || u._id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] font-medium text-slate-600">
                      {u.email}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-[11px] font-bold text-indigo-600 tabular-nums">
                          {(() => {
                            const phone = u.phone;
                            if (!phone) return "-";
                            const digitsOnly = phone.replace(/\D/g, "");
                            return digitsOnly.length >= 10
                              ? digitsOnly.slice(-10)
                              : digitsOnly;
                          })()}
                        </div>
                        <div
                          className="flex items-center gap-1.5 cursor-pointer group/pass"
                          onClick={() => togglePasswordVisibility(u._id)}
                        >
                          <div className="text-[10px] font-mono text-slate-400 font-bold tracking-tight">
                            {u.rawPassword
                              ? visiblePasswords.includes(u._id)
                                ? u.rawPassword
                                : "••••••••"
                              : visiblePasswords.includes(u._id)
                                ? u.email === "superadmin@platform.com"
                                  ? "1111111"
                                  : "••••••••"
                                : "••••••••"}
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover/pass:bg-indigo-400 transition-colors"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 inline-flex text-[9px] leading-none font-black rounded uppercase tracking-widest ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                            : u.role === "COMPANY_ADMIN"
                              ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                              : u.role === "DEPARTMENT_ADMIN"
                                ? "bg-purple-50 text-purple-600 border border-purple-100"
                                : "bg-slate-50 text-slate-600 border border-slate-100"
                        }`}
                      >
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-500">
                      {typeof u.companyId === "object" && u.companyId?.name
                        ? u.companyId.name
                        : u.companyId
                          ? String(u.companyId)
                          : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={`px-2 py-0.5 inline-flex text-[9px] uppercase tracking-widest leading-none font-black rounded-md transition-all hover:scale-105 active:scale-95 border ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                        }`}
                      >
                        {u.isActive ? "Active" : "Suspended"}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          onClick={() => handleEditUser(u)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => handleDeleteUser(u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={userPage}
          totalPages={userPagination.pages}
          totalItems={userPagination.total}
          itemsPerPage={userPagination.limit}
          onPageChange={setUserPage}
          className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
        />
      </CardContent>
    </Card>
  );
};

export default UserTabContent;
