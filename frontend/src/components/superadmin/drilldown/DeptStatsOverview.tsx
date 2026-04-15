import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar } from "lucide-react";

interface DeptStatsOverviewProps {
  stats: {
    totalUsers: number;
    totalGrievances: number;
    totalAppointments: number;
    activeUsers: number;
    pendingGrievances: number;
    resolvedGrievances: number;
  };
  setActiveTab: (tab: string) => void;
}

const DeptStatsOverview: React.FC<DeptStatsOverviewProps> = ({
  stats,
  setActiveTab,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card
        className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("users")}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            Total Users
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-4xl font-bold text-white mb-1">
            {stats.totalUsers}
          </p>
          <p className="text-sm text-white/70">
            {stats.activeUsers} active users
          </p>
        </CardContent>
      </Card>

      <Card
        className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("grievances")}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            Open Grievances
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-4xl font-bold text-white mb-1">
            {stats.totalGrievances}
          </p>
          <p className="text-sm text-white/70">
            {stats.pendingGrievances} pending right now
          </p>
        </CardContent>
      </Card>

      <Card
        className="group relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("appointments")}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            Appointments
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-4xl font-bold text-white mb-1">
            {stats.totalAppointments}
          </p>
          <p className="text-sm text-white/70">Scheduled appointments</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeptStatsOverview;
