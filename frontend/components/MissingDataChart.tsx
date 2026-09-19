"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle } from "lucide-react";
import { ColumnStatistics } from "@/types";

interface Props {
  columns: Record<string, ColumnStatistics> | null;
  loading: boolean;
}

export default function MissingDataChart({ columns, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-700 rounded mb-3" />
        <div className="h-32 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!columns) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Missing Data</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2">No data available</p>
      </div>
    );
  }

  const entries = Object.entries(columns);
  const totalMissing = entries.reduce((sum, [, s]) => sum + s.missing_count, 0);

  const chartData = entries
    .map(([name, stats]) => ({
      name: name.length > 12 ? name.slice(0, 12) + "..." : name,
      fullName: name,
      missing: stats.missing_count,
      percentage: stats.missing_pct,
      total: stats.count + stats.missing_count,
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.missing - a.missing);

  const hasMissing = chartData.some((d) => d.missing > 0);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-white">Missing Data</h3>
        </div>
        {totalMissing > 0 && (
          <span className="text-[10px] text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded">
            {totalMissing} total missing
          </span>
        )}
      </div>

      {!hasMissing ? (
        <div className="flex items-center justify-center h-20 text-xs text-green-400">
          No missing values in any column
        </div>
      ) : (
        <>
          <div className="h-40 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: 11,
                  }}
                  formatter={(value, name, props) => [
                    `${value} (${props?.payload?.percentage ?? 0}%)`,
                    "Missing",
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                />
                <Bar dataKey="missing" radius={[0, 4, 4, 0]}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.percentage > 20 ? "#ef4444" : d.percentage > 5 ? "#f59e0b" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto">
            {chartData.slice(0, 10).map((d) => (
              <div key={d.fullName} className="flex justify-between text-[11px]">
                <span className="text-gray-300 truncate max-w-[100px]" title={d.fullName}>
                  {d.fullName}
                </span>
                <span className="text-gray-500">
                  {d.missing} ({d.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
