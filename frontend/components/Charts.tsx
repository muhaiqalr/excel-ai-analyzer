"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

interface ChartDataItem {
  name?: string;
  value?: number | null;
  x?: number | null;
  y?: number | null;
  [key: string]: unknown;
}

interface NormalizedChart {
  chart_type: string;
  title: string;
  x_column: string | null;
  y_column: string | null;
  data: ChartDataItem[];
}

interface Props {
  charts: unknown[];
  loading: boolean;
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

function normalizeChart(raw: unknown): NormalizedChart | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const cfg = c.config && typeof c.config === "object" ? c.config as Record<string, unknown> : null;

  const chart_type = (cfg?.chart_type || c.chart_type || "bar") as string;
  const title = (cfg?.title || c.title || "Chart") as string;
  const x_column = (cfg?.x_column ?? c.x_column ?? null) as string | null;
  const y_column = (cfg?.y_column ?? c.y_column ?? null) as string | null;
  let data: ChartDataItem[] = [];

  const rawData = cfg?.data ?? c.data;
  if (Array.isArray(rawData)) {
    data = rawData.filter((d): d is ChartDataItem => {
      if (!d || typeof d !== "object") return false;
      const item = d as Record<string, unknown>;
      if ("value" in item && (item.value === null || item.value === undefined || (typeof item.value === "number" && isNaN(item.value)))) return false;
      if ("x" in item && "y" in item) {
        if (item.x === null || item.y === null) return false;
      }
      return true;
    });
  }

  return { chart_type, title, x_column, y_column, data };
}

function ChartCard({ chart }: { chart: NormalizedChart }) {
  const { chart_type, title, data } = chart;
  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h4 className="text-sm font-medium text-white mb-3">{title}</h4>
        <div className="flex items-center justify-center h-[250px] text-gray-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
  };

  function renderChart() {
    switch (chart_type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={safeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {safeData.map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={safeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6" }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={safeData} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label labelLine={false}>
                {safeData.map((_: unknown, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" dataKey="x" name={chart.x_column || "X"} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name={chart.y_column || "Y"} tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Scatter data={safeData} fill="#06b6d4" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-[250px] text-gray-500 text-sm">
            No chart data available
          </div>
        );
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h4 className="text-sm font-medium text-white mb-3">{title}</h4>
      {renderChart()}
      {chart.x_column && chart.y_column && (
        <p className="text-xs text-gray-500 mt-2">
          X: {chart.x_column} | Y: {chart.y_column}
        </p>
      )}
    </div>
  );
}

export default function Charts({ charts, loading }: Props) {
  const [normalized, setNormalized] = useState<NormalizedChart[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!Array.isArray(charts)) {
        setNormalized([]);
        return;
      }
      const result: NormalizedChart[] = [];
      for (const raw of charts) {
        const n = normalizeChart(raw);
        if (n) result.push(n);
      }
      setNormalized(result);
      setError(null);
    } catch {
      setNormalized([]);
      setError("Failed to process chart data.");
    }
  }, [charts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  if (normalized.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p className="text-sm">No charts available for this sheet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      {normalized.map((chart, idx) => (
        <ChartCard key={`${chart.chart_type}-${chart.title}-${idx}`} chart={chart} />
      ))}
    </div>
  );
}
