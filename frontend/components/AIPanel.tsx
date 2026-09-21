"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Lightbulb, BarChart3, Loader2, RefreshCw, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { analysisAPI } from "@/lib/api";

interface Props {
  fileId: string;
  columns: string[];
  rows: unknown[][];
  datasetVersion: number;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

function MiniChart({ chart }: { chart: { chart_type: string; title: string; data: { name: string; value: number }[] } }) {
  if (!chart.data || chart.data.length === 0) return null;
  const ts = { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: 10 };

  switch (chart.chart_type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} angle={-30} textAnchor="end" height={40} interval={0} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <Tooltip contentStyle={ts} />
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
            <Tooltip contentStyle={ts} />
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
            <Tooltip contentStyle={ts} />
          </PieChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
}

export default function AIPanel({ fileId, columns, rows, datasetVersion }: Props) {
  const [summary, setSummary] = useState<string>("");
  const [insights, setInsights] = useState<string[]>([]);
  const [charts, setCharts] = useState<{ chart_type: string; title: string; data: { name: string; value: number }[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (columns.length === 0 || rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analysisAPI.quickAnalysis(fileId, columns, rows);
      setSummary(res.data.summary || "");
      setInsights(res.data.insights || []);
      setCharts(res.data.charts || []);
    } catch (err: unknown) {
      console.error("Quick analysis error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [fileId, columns, rows, datasetVersion]);

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      const t = setTimeout(analyze, 500);
      return () => clearTimeout(t);
    }
  }, [columns, rows, datasetVersion, analyze]);

  const hasData = summary || insights.length > 0 || charts.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">AI Analysis</h3>
        <button
          onClick={analyze}
          disabled={loading || columns.length === 0}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          title="Regenerate"
        >
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading */}
      {loading && !hasData && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing your data...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-white">Summary</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-white">Key Insights</span>
          </div>
          <ul className="space-y-1.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
                <span className="leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts */}
      {charts.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-white">Charts</span>
          </div>
          <div className="space-y-3">
            {charts.map((chart, i) => (
              <div key={i}>
                <p className="text-[10px] text-gray-400 mb-1">{chart.title}</p>
                <MiniChart chart={chart} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasData && columns.length > 0 && (
        <p className="text-xs text-gray-500 py-4 text-center">Analyzing...</p>
      )}
    </div>
  );
}
