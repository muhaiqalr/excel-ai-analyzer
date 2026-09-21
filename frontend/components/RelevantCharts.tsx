"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { BarChart3, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { analysisAPI } from "@/lib/api";

interface ChartData {
  chart_type: string;
  title: string;
  x_column: string | null;
  y_column: string | null;
  data: { name: string; value: number; x?: number; y?: number }[];
}

interface Props {
  fileId: string;
  columns: string[];
  rows: unknown[][];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

function MiniChart({ chart }: { chart: ChartData }) {
  if (!chart.data || chart.data.length === 0) return null;

  const tooltipStyle = { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: 10 };

  switch (chart.chart_type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} angle={-30} textAnchor="end" height={40} interval={0} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chart.data.map((_: unknown, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    case "line":
      return (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    case "pie":
      return (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={chart.data} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name" label labelLine={false}>
              {chart.data.map((_: unknown, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
}

export default function RelevantCharts({ fileId, columns, rows }: Props) {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCharts = useCallback(async () => {
    if (columns.length === 0 || rows.length === 0) {
      setCharts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analysisAPI.calculateCharts(columns, rows);
      const suggestions = res.data.suggestions || [];
      setCharts(suggestions.slice(0, 4));
    } catch (err: unknown) {
      console.error("Charts error:", err);
      const msg = err instanceof Error ? err.message : "Unable to generate charts.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [columns, rows]);

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      const timeout = setTimeout(generateCharts, 1000);
      return () => clearTimeout(timeout);
    }
  }, [columns, rows, generateCharts]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Charts</h3>
        </div>
        <button
          onClick={generateCharts}
          disabled={loading || columns.length === 0}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          title="Regenerate"
        >
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && charts.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating charts...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : charts.length > 0 ? (
        <div className="space-y-3">
          {charts.map((chart, idx) => (
            <div key={idx}>
              <p className="text-[10px] text-gray-400 mb-1">{chart.title}</p>
              <MiniChart chart={chart} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Upload data to see charts</p>
      )}
    </div>
  );
}
