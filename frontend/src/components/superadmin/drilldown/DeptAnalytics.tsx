import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, FileText, Users } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
} from "recharts";

interface DeptAnalyticsProps {
  grievanceStatusData: any[];
  userRoleData: any[];
}

const DeptAnalytics: React.FC<DeptAnalyticsProps> = ({
  grievanceStatusData,
  userRoleData,
}) => {
  return (
    <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-white">
              Department Analytics
            </CardTitle>
            <CardDescription className="text-violet-100">
              View department statistics and insights
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grievance Status Chart */}
          <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b px-5 py-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Grievance Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {grievanceStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={grievanceStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {grievanceStatusData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <p>No grievance data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Roles Chart */}
          <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b px-5 py-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Users by Role
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {userRoleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={userRoleData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-400">
                  <p>No user data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeptAnalytics;
