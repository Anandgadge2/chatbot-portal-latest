"use client";

import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";

interface GrievanceTrendChartProps {
  data: any[];
}

export function GrievanceTrendChart({ data }: GrievanceTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 border border-dashed rounded-lg">
        No trend data available
      </div>
    );
  }

  const chartData = data.slice(-7).map((d) => ({
    name: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="grievanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} 
          axisLine={false}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis 
          tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} 
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#grievanceGrad)"
          name="Grievances"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
