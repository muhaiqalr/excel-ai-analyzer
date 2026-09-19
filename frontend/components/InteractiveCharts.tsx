"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Settings,
  Loader2,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ChartResult } from "@/types";
import { analysisAPI } from "@/lib/api";

interface Props {
  columns: string[];
  rows: unknown[][];
  colTypes: Record<string, string>;
  loading: boolean;
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#6366f1",
  "#f97316", "#14b8a6", "#a855f7", "#3b82f6",
];

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="w-3.5 h-3.5" />,
  line: <TrendingUp className="w-3.5 h-3.5" />,
  pie: <PieIcon className="w-3.5 h-3.5" />,
  doughnut: <Circle className="w-3.5 h-3.5" />,
  scatter: <Circle className="w-3.5 h-3.5" />,
  area: <TrendingUp className="w-3.5 h-3.5" />,
};

function ChartRenderer({ chart }: { chart: ChartResult }) {
  const data = chart.data;
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-gray-500 text-xs">
        No data available for this chart
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    fontSize: 11,
  };

  switch (chart.chart_type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-30} textAnchor="end" height={50} interval={0} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-30} textAnchor="end" height={50} interval={0} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case "pie":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label labelLine={false}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );

    case "doughnut":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={50}
              dataKey="value"
              nameKey="name"
              label
              labelLine={false}
            >
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-30} textAnchor="end" height={50} interval={0} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case "scatter":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" dataKey="x" name={chart.x_column || "X"} tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name={chart.y_column || "Y"} tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Scatter data={data} fill="#06b6d4" />
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      return (
        <div className="flex items-center justify-center h-[220px] text-gray-500 text-xs">
          Unsupported chart type: {chart.chart_type}
        </div>
      );
  }
}

export default function InteractiveCharts({ columns, rows, colTypes, loading: dataLoading }: Props) {
  const [charts, setCharts] = useState<ChartResult[]>([]);
  const [chartColTypes, setChartColTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [selectedType, setSelectedType] = useState("");
  const [selectedX, setSelectedX] = useState("");
  const [selectedY, setSelectedY] = useState("");
  const [selectedAgg, setSelectedAgg] = useState("sum");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoricalCols = Object.entries(chartColTypes)
    .filter(([, t]) => t === "categorical" || t === "boolean" || t === "text")
    .map(([c]) => c);
  const numericCols = Object.entries(chartColTypes)
    .filter(([, t]) => t === "numeric")
    .map(([c]) => c);
  const dateCols = Object.entries(chartColTypes)
    .filter(([, t]) => t === "date")
    .map(([c]) => c);
  const allCols = Object.keys(chartColTypes);

  const loadCharts = useCallback(
    async (chartType?: string, xCol?: string, yCol?: string, agg?: string) => {
      if (columns.length === 0 || rows.length === 0) {
        setCharts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await analysisAPI.calculateCharts(columns, rows, {
          chart_type: chartType || undefined,
          x_column: xCol || undefined,
          y_column: yCol || undefined,
          aggregation: agg || undefined,
        });
        setCharts(res.data.suggestions || []);
        setChartColTypes(res.data.columns || {});
      } catch {
        setCharts([]);
      } finally {
        setLoading(false);
      }
    },
    [columns, rows]
  );

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      loadCharts();
    }
  }, [columns, rows, loadCharts]);

  function handleCustomChart() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadCharts(selectedType || undefined, selectedX || undefined, selectedY || undefined, selectedAgg);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (dataLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Charts</h3>
          {charts.length > 0 && (
            <span className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
              {charts.length} charts
            </span>
          )}
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
        >
          <Settings className="w-3 h-3" />
          Configure
          {showConfig ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>

      {showConfig && (
        <div className="bg-gray-900/50 rounded-lg p-3 mb-3 border border-gray-700/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Chart Type</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setTimeout(handleCustomChart, 0);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">Auto</option>
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
                <option value="doughnut">Doughnut</option>
                <option value="area">Area</option>
                <option value="scatter">Scatter</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Aggregation</label>
              <select
                value={selectedAgg}
                onChange={(e) => {
                  setSelectedAgg(e.target.value);
                  setTimeout(handleCustomChart, 0);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="sum">Sum</option>
                <option value="mean">Average</option>
                <option value="count">Count</option>
                <option value="min">Minimum</option>
                <option value="max">Maximum</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">X-Axis Column</label>
              <select
                value={selectedX}
                onChange={(e) => {
                  setSelectedX(e.target.value);
                  setTimeout(handleCustomChart, 0);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">Auto</option>
                {allCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Y-Axis Column</label>
              <select
                value={selectedY}
                onChange={(e) => {
                  setSelectedY(e.target.value);
                  setTimeout(handleCustomChart, 0);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">Auto</option>
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      ) : charts.length === 0 ? (
        <div className="text-center text-gray-500 text-xs py-8">
          No charts available. Add numeric or categorical data to see visualizations.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {charts.map((chart, i) => (
            <div key={i} className="bg-gray-900/50 rounded-lg border border-gray-700/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400">{CHART_ICONS[chart.chart_type] || <BarChart3 className="w-3.5 h-3.5" />}</span>
                <h4 className="text-xs font-medium text-white truncate">{chart.title}</h4>
              </div>
              <ChartRenderer chart={chart} />
              {chart.x_column && chart.y_column && (
                <p className="text-[10px] text-gray-500 mt-1">
                  X: {chart.x_column} | Y: {chart.y_column}
                  {chart.aggregation && ` | ${chart.aggregation}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
