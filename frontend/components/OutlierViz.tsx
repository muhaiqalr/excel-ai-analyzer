"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Target, AlertCircle } from "lucide-react";
import { OutlierResult } from "@/types";

interface Props {
  outliers: Record<string, OutlierResult> | null;
  loading: boolean;
}

const COLORS = ["#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#6366f1", "#f97316"];

export default function OutlierViz({ outliers, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-4 w-24 bg-gray-700 rounded mb-3" />
        <div className="h-32 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!outliers) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Outliers</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2">No outlier data available</p>
      </div>
    );
  }

  const entries = Object.entries(outliers);

  if (entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Outliers</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-3 h-3" />
          <span>No numeric columns with detectable outliers</span>
        </div>
      </div>
    );
  }

  const chartData = entries.map(([col, info]) => ({
    name: col,
    outliers: info.outlier_count,
    total: info.total_count,
    percentage: info.outlier_percentage,
    lower: info.lower_bound,
    upper: info.upper_bound,
  }));

  const totalOutliers = entries.reduce((sum, [, v]) => sum + v.outlier_count, 0);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-white">Outlier Detection</h3>
        </div>
        <span className="text-[10px] text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded">
          {totalOutliers} potential outliers
        </span>
      </div>

      {totalOutliers > 0 && (
        <div className="h-40 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: 11,
                }}
                formatter={(value, name) => [
                  name === "outliers" ? `${value} outliers` : value,
                  name === "outliers" ? "Count" : String(name),
                ]}
              />
              <Bar dataKey="outliers" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {entries.map(([col, info]) => (
          <div key={col} className="bg-gray-900/50 rounded px-2 py-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">{col}</span>
              <span className={`font-mono ${info.outlier_count > 0 ? "text-amber-300" : "text-green-300"}`}>
                {info.outlier_count} / {info.total_count} ({info.outlier_percentage}%)
              </span>
            </div>
            <div className="flex gap-3 text-gray-500 mt-0.5">
              <span>Lower: {info.lower_bound.toFixed(2)}</span>
              <span>Upper: {info.upper_bound.toFixed(2)}</span>
              <span>IQR: {info.iqr.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
