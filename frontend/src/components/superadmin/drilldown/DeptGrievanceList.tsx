import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText, Search, Download, RefreshCw } from "lucide-react";
import { Grievance, grievanceAPI } from "@/lib/api/grievance";

interface DeptGrievanceListProps {
  filteredGrievances: Grievance[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  setSelectedGrievance: (g: Grievance) => void;
  setShowGrievanceDetail: (val: boolean) => void;
  exportToCSV: (data: any[], filename: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const DeptGrievanceList: React.FC<DeptGrievanceListProps> = ({
  filteredGrievances,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  setSelectedGrievance,
  setShowGrievanceDetail,
  exportToCSV,
  onRefresh,
  refreshing,
}) => {
  return (
    <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm text-left">
      <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Grievances ({filteredGrievances.length})
              </CardTitle>
              <CardDescription className="text-blue-100 font-medium">
                Public resolution status and tracking
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30 disabled:opacity-50"
                title="Refresh Grievance Data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={() => exportToCSV(filteredGrievances, "grievances")}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Filters */}
      <div className="px-6 py-4 bg-white/50 border-b border-slate-200">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search grievances..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <CardContent className="p-0">
        {filteredGrievances.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No grievances found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-100">
                <tr>
                  <th className="px-3 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">
                    Sr. No.
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">
                    Grievance ID
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">
                    Citizen
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">
                    Created
                  </th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGrievances.slice(0, 50).map((g, index) => (
                  <tr
                    key={g._id}
                    className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all"
                  >
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-sm text-blue-700">
                        {g.grievanceId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={async () => {
                          const response = await grievanceAPI.getById(g._id);
                          if (response.success) {
                            setSelectedGrievance(response.data.grievance);
                            setShowGrievanceDetail(true);
                          }
                        }}
                        className="text-left hover:text-blue-600"
                      >
                        <p className="font-semibold text-gray-900 hover:underline">
                          {g.citizenName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {g.citizenPhone}
                        </p>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded">
                        {g.category || "General"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          g.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : g.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(g.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={async () => {
                          const response = await grievanceAPI.getById(g._id);
                          if (response.success) {
                            setSelectedGrievance(response.data.grievance);
                            setShowGrievanceDetail(true);
                          }
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        View
                      </button>
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

export default DeptGrievanceList;
