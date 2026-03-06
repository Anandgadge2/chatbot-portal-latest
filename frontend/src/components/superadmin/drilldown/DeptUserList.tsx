import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Users, Search, Download, ArrowUpDown } from "lucide-react";
import { User } from "@/lib/api/user";

interface DeptUserListProps {
  filteredUsers: User[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  handleSort: (key: string) => void;
  exportToCSV: (data: any[], filename: string) => void;
}

const DeptUserList: React.FC<DeptUserListProps> = ({
  filteredUsers,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  handleSort,
  exportToCSV,
}) => {
  return (
    <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Users ({filteredUsers.length})
              </CardTitle>
              <CardDescription className="text-emerald-100">
                All users in this department
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => exportToCSV(filteredUsers, "users")}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </CardHeader>

      {/* Filters */}
      <div className="px-6 py-4 bg-white/50 border-b border-slate-200">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Roles</option>
            <option value="DEPARTMENT_ADMIN">Department Admin</option>
            <option value="OPERATOR">Operator</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <CardContent className="p-0">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b border-emerald-100">
                <tr>
                  <th className="px-3 py-4 text-center text-[11px] font-bold text-emerald-700 uppercase">
                    Sr. No.
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("firstName")}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase hover:text-emerald-800"
                    >
                      User <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, index) => (
                  <tr
                    key={u._id}
                    className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all"
                  >
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                          {u.firstName?.[0]}
                          {u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{u.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeptUserList;
