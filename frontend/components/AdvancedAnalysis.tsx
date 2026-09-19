"use client";

import { useState } from "react";
import {
  User,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  GitCompareArrows,
  ArrowUpDown,
  CalendarDays,
  BarChart3,
  FileText,
  MessageCircle,
  Loader2,
  X,
  Sparkles,
  Send,
  ArrowUp,
  ArrowDown,
  Target,
} from "lucide-react";
import { advancedAPI } from "@/lib/api";
import { Sheet } from "@/types";

interface Props {
  fileId: string;
  sheets: Sheet[];
  onChartRequest?: (config: Record<string, unknown>) => void;
}

type ActivePanel =
  | "profile"
  | "insights"
  | "trends"
  | "anomalies"
  | "compare"
  | "top-bottom"
  | "forecast"
  | "chart-recommend"
  | "report"
  | "ask"
  | null;

interface ProfileColumn {
  type: string;
  count: number;
  missing_count: number;
  missing_pct: number;
  non_null_count: number;
  sum?: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
  range?: number;
  unique_count?: number;
  most_common?: string;
  most_common_count?: number;
}

interface ProfileResponse {
  overview: {
    total_rows: number;
    total_columns: number;
    total_cells: number;
    missing_cells: number;
    missing_percentage: number;
    numeric_columns: number;
    text_columns: number;
    date_columns: number;
    categorical_columns: number;
    boolean_columns: number;
  };
  columns: Record<string, ProfileColumn>;
}

interface InsightsResponse {
  sections: { title: string; items: string[] }[];
}

interface TrendsResponse {
  trend_direction: string;
  slope: number;
  peaks: { index: number; value: number }[];
  drops: { index: number; value: number }[];
  period_changes: { period: string; change: number }[];
  summary: string;
}

interface Anomaly {
  column: string;
  index: number;
  value: number;
  method: string;
  reason: string;
}

interface AnomaliesResponse {
  anomalies: Anomaly[];
  total_anomalies: number;
  columns_checked: number;
}

interface CompareGroup {
  name: string;
  count: number;
  mean: number;
  median: number;
  std: number;
  pct_difference: number;
}

interface CompareResponse {
  group_column: string;
  value_column: string;
  groups: CompareGroup[];
}

interface TopBottomResponse {
  column: string;
  ascending: boolean;
  values: { rank: number; value: unknown; index: number }[];
}

interface ForecastEntry {
  period: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
}

interface ForecastResponse {
  date_column: string;
  value_column: string;
  forecasts: ForecastEntry[];
  confidence_note: string;
}

interface ChartRecommendation {
  chart_type: string;
  title: string;
  x_column: string;
  y_column: string;
  reason: string;
}

interface ChartRecommendResponse {
  recommendations: ChartRecommendation[];
}

interface ReportResponse {
  report: string;
}

interface AskResponse {
  answer: string;
  references?: string[];
}

const SECTION_ICONS: Record<string, typeof Lightbulb> = {
  Overview: Sparkles,
  "Key Findings": Lightbulb,
  Trends: TrendingUp,
  "Missing Data": AlertTriangle,
  Outliers: AlertTriangle,
  Correlations: GitCompareArrows,
  Recommendations: BarChart3,
};

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  );
}

export default function AdvancedAnalysis({
  fileId,
  sheets,
  onChartRequest,
}: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [compareGroupCol, setCompareGroupCol] = useState("");
  const [compareValueCol, setCompareValueCol] = useState("");
  const [showCompareInputs, setShowCompareInputs] = useState(false);

  const [tbColumn, setTbColumn] = useState("");
  const [tbCount, setTbCount] = useState(5);
  const [showTbInputs, setShowTbInputs] = useState(false);

  const [forecastDateCol, setForecastDateCol] = useState("");
  const [forecastValueCol, setForecastValueCol] = useState("");
  const [forecastPeriods, setForecastPeriods] = useState(3);
  const [showForecastInputs, setShowForecastInputs] = useState(false);

  const [askQuestion, setAskQuestion] = useState("");

  const numericColumns = Object.entries(sheets[0]?.column_types ?? {})
    .filter(([, t]) => t === "number" || t === "numeric")
    .map(([name]) => name);

  const dateColumns = Object.entries(sheets[0]?.column_types ?? {})
    .filter(([, t]) => t === "date" || t === "datetime")
    .map(([name]) => name);

  const allColumns = sheets.flatMap((s) => s.column_names);

  async function runPanel(
    panel: ActivePanel,
    apiCall: () => Promise<{ data: Record<string, unknown> }>
  ) {
    setLoading(true);
    setError(null);
    setResult(null);
    setActivePanel(panel);
    try {
      const res = await apiCall();
      setResult(res.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function closeAllInputs() {
    setShowCompareInputs(false);
    setShowTbInputs(false);
    setShowForecastInputs(false);
  }

  function handleButtonClick(btnId: string) {
    closeAllInputs();

    switch (btnId) {
      case "profile":
        runPanel("profile", () => advancedAPI.profile(fileId));
        break;
      case "insights":
        runPanel("insights", () => advancedAPI.insights(fileId));
        break;
      case "trends":
        runPanel("trends", () => advancedAPI.trends(fileId));
        break;
      case "anomalies":
        runPanel("anomalies", () => advancedAPI.anomalies(fileId));
        break;
      case "compare":
        setShowCompareInputs(true);
        setActivePanel(null);
        setResult(null);
        setError(null);
        break;
      case "top-bottom":
        setShowTbInputs(true);
        setActivePanel(null);
        setResult(null);
        setError(null);
        break;
      case "forecast":
        setShowForecastInputs(true);
        setActivePanel(null);
        setResult(null);
        setError(null);
        break;
      case "chart-recommend":
        runPanel("chart-recommend", () => advancedAPI.chartRecommend(fileId));
        break;
      case "report":
        runPanel("report", () => advancedAPI.report(fileId));
        break;
      case "ask":
        setActivePanel("ask");
        setResult(null);
        setError(null);
        break;
    }
  }

  function handleCompare() {
    if (!compareGroupCol || !compareValueCol) return;
    runPanel("compare", () =>
      advancedAPI.compare(fileId, compareGroupCol, compareValueCol)
    );
    setShowCompareInputs(false);
  }

  function handleTopBottom(ascending: boolean) {
    if (!tbColumn) return;
    runPanel("top-bottom", () =>
      advancedAPI.topBottom(fileId, tbColumn, tbCount, ascending)
    );
    setShowTbInputs(false);
  }

  function handleForecast() {
    if (!forecastDateCol || !forecastValueCol) return;
    runPanel("forecast", () =>
      advancedAPI.forecast(fileId, forecastDateCol, forecastValueCol, forecastPeriods)
    );
    setShowForecastInputs(false);
  }

  function handleAsk() {
    if (!askQuestion.trim()) return;
    runPanel("ask", () => advancedAPI.ask(fileId, askQuestion.trim()));
  }

  function renderProfile(data: ProfileResponse) {
    const cols = Object.entries(data.columns);
    return (
      <div className="space-y-3">
        {data.overview && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400">{data.overview.total_rows}</p>
                <p className="text-xs text-gray-400">Rows</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{data.overview.total_columns}</p>
                <p className="text-xs text-gray-400">Columns</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-400">{data.overview.total_cells}</p>
                <p className="text-xs text-gray-400">Cells</p>
              </div>
            </div>
            {data.overview.missing_cells > 0 && (
              <p className="text-xs text-amber-300 text-center">
                {data.overview.missing_cells} missing cells ({data.overview.missing_percentage}%)
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cols.map(([name, stats]) => (
            <div key={name} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white truncate">{name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                  {stats.type}
                </span>
              </div>
              <div className="space-y-0.5">
                <StatRow label="Count" value={stats.count} />
                <StatRow label="Missing" value={`${stats.missing_count} (${stats.missing_pct}%)`} />
                {stats.mean !== undefined && (
                  <>
                    <StatRow label="Mean" value={Number(stats.mean).toFixed(2)} />
                    <StatRow label="Median" value={Number(stats.median).toFixed(2)} />
                    <StatRow label="Min" value={Number(stats.min).toFixed(2)} />
                    <StatRow label="Max" value={Number(stats.max).toFixed(2)} />
                    <StatRow label="Std Dev" value={Number(stats.std).toFixed(2)} />
                  </>
                )}
                {stats.unique_count !== undefined && (
                  <StatRow label="Unique" value={stats.unique_count} />
                )}
                {stats.most_common && (
                  <StatRow label="Most Common" value={stats.most_common} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderInsights(data: InsightsResponse) {
    const sections = data.sections ?? [];
    return (
      <div className="space-y-3">
        {sections.map((section, i) => {
          const Icon = SECTION_ICONS[section.title] ?? Lightbulb;
          return (
            <div key={i} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-yellow-400" />
                <h4 className="text-sm font-medium text-white">{section.title}</h4>
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-xs text-gray-300">
                    <span className="text-yellow-500 mt-0.5 shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTrends(data: TrendsResponse) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <h4 className="text-sm font-medium text-white">Trend Summary</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="text-center">
              <p className={`text-lg font-bold ${
                data.trend_direction === "increasing"
                  ? "text-green-400"
                  : data.trend_direction === "decreasing"
                  ? "text-red-400"
                  : "text-gray-400"
              }`}>
                {data.trend_direction === "increasing" ? "\u2197" : data.trend_direction === "decreasing" ? "\u2198" : "\u2192"}
              </p>
              <p className="text-gray-400">Direction</p>
              <p className="text-white capitalize">{data.trend_direction}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-400">
                {data.slope !== undefined ? Number(data.slope).toFixed(4) : "N/A"}
              </p>
              <p className="text-gray-400">Slope</p>
            </div>
          </div>
          {data.summary && <p className="text-xs text-gray-300 mt-2">{data.summary}</p>}
        </div>

        {data.peaks && data.peaks.length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-medium text-white">Peaks</h4>
            </div>
            <div className="space-y-1">
              {data.peaks.map((p, i) => (
                <div key={i} className="flex justify-between text-xs bg-green-900/20 rounded px-2 py-1">
                  <span className="text-gray-300">Index {p.index}</span>
                  <span className="text-green-300 font-mono">{Number(p.value).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.drops && data.drops.length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="w-4 h-4 text-red-400" />
              <h4 className="text-sm font-medium text-white">Drops</h4>
            </div>
            <div className="space-y-1">
              {data.drops.map((d, i) => (
                <div key={i} className="flex justify-between text-xs bg-red-900/20 rounded px-2 py-1">
                  <span className="text-gray-300">Index {d.index}</span>
                  <span className="text-red-300 font-mono">{Number(d.value).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.period_changes && data.period_changes.length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-medium text-white">Period Changes</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 pb-1">Period</th>
                    <th className="text-right text-gray-400 pb-1">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.period_changes.map((pc, i) => (
                    <tr key={i} className="border-t border-gray-700/50">
                      <td className="py-1 text-gray-300">{pc.period}</td>
                      <td className={`py-1 text-right font-mono ${pc.change >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {pc.change >= 0 ? "+" : ""}{Number(pc.change).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAnomalies(data: AnomaliesResponse) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 flex items-center gap-3">
          <Target className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-gray-300">
            Found <span className="text-orange-400 font-bold">{data.total_anomalies}</span> anomalies
            across <span className="text-white font-bold">{data.columns_checked}</span> columns
          </span>
        </div>
        {data.anomalies.length > 0 ? (
          <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Column</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Index</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Value</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Method</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.map((a, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white font-medium">{a.column}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono">{a.index}</td>
                      <td className="px-3 py-2 text-orange-300 font-mono text-right">
                        {Number(a.value).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{a.method}</td>
                      <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 text-center text-gray-500 text-xs">
            No anomalies detected
          </div>
        )}
      </div>
    );
  }

  function renderCompare(data: CompareResponse) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
          <p className="text-xs text-gray-400">
            Comparing <span className="text-white">{data.value_column}</span> across groups in{" "}
            <span className="text-white">{data.group_column}</span>
          </p>
        </div>
        {data.groups.length > 0 ? (
          <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Group</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Count</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Mean</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Median</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Std Dev</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">% Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white font-medium">{g.name}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono text-right">{g.count}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono text-right">
                        {Number(g.mean).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-300 font-mono text-right">
                        {Number(g.median).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-300 font-mono text-right">
                        {Number(g.std).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 font-mono text-right ${g.pct_difference >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {g.pct_difference >= 0 ? "+" : ""}{Number(g.pct_difference).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 text-center text-gray-500 text-xs">
            No group data available
          </div>
        )}
      </div>
    );
  }

  function renderTopBottom(data: TopBottomResponse) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
          <p className="text-xs text-gray-400">
            {data.ascending ? "Bottom" : "Top"} values for{" "}
            <span className="text-white">{data.column}</span>
          </p>
        </div>
        {data.values.length > 0 ? (
          <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Rank</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Row Index</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.values.map((v, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white font-medium">{v.rank}</td>
                      <td className="px-3 py-2 text-gray-300 font-mono">{v.index}</td>
                      <td className="px-3 py-2 text-cyan-300 font-mono text-right">
                        {typeof v.value === "number" ? v.value.toFixed(2) : String(v.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 text-center text-gray-500 text-xs">
            No data available
          </div>
        )}
      </div>
    );
  }

  function renderForecast(data: ForecastResponse) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
          <p className="text-xs text-gray-400">
            Forecasting <span className="text-white">{data.value_column}</span> based on{" "}
            <span className="text-white">{data.date_column}</span>
          </p>
        </div>
        {data.forecasts.length > 0 ? (
          <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Period</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Predicted</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Lower Bound</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Upper Bound</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecasts.map((f, i) => (
                    <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-white font-medium">{f.period}</td>
                      <td className="px-3 py-2 text-pink-300 font-mono text-right">
                        {Number(f.predicted_value).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono text-right">
                        {Number(f.lower_bound).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-gray-400 font-mono text-right">
                        {Number(f.upper_bound).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 text-center text-gray-500 text-xs">
            No forecast data available
          </div>
        )}
        {data.confidence_note && (
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
            <p className="text-[10px] text-gray-500 italic">{data.confidence_note}</p>
          </div>
        )}
      </div>
    );
  }

  function renderChartRecommendations(data: ChartRecommendResponse) {
    const recs = data.recommendations ?? [];
    return (
      <div className="space-y-3">
        {recs.map((rec, i) => (
          <div key={i} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white">{rec.title}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300">
                {rec.chart_type}
              </span>
            </div>
            <div className="text-xs text-gray-400 mb-2 space-y-0.5">
              {rec.x_column && <p>X: <span className="text-gray-300">{rec.x_column}</span></p>}
              {rec.y_column && <p>Y: <span className="text-gray-300">{rec.y_column}</span></p>}
              {rec.reason && <p className="text-gray-500 italic">{rec.reason}</p>}
            </div>
            {onChartRequest && (
              <button
                onClick={() =>
                  onChartRequest({
                    chart_type: rec.chart_type,
                    x_column: rec.x_column,
                    y_column: rec.y_column,
                    title: rec.title,
                  })
                }
                className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors"
              >
                Create Chart
              </button>
            )}
          </div>
        ))}
        {recs.length === 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 text-center text-gray-500 text-xs">
            No chart recommendations available
          </div>
        )}
      </div>
    );
  }

  function renderReport(data: ReportResponse) {
    const lines = (data.report ?? "").split("\n");
    return (
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-teal-400" />
          <h4 className="text-sm font-medium text-white">Analysis Report</h4>
        </div>
        <div className="space-y-1 text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {lines.map((line, i) => {
            if (line.startsWith("# ")) {
              return <h3 key={i} className="text-sm font-bold text-white mt-3">{line.slice(2)}</h3>;
            }
            if (line.startsWith("## ")) {
              return <h4 key={i} className="text-xs font-bold text-teal-300 mt-2">{line.slice(3)}</h4>;
            }
            if (line.startsWith("- ")) {
              return <p key={i} className="pl-3 text-gray-400">&#8226; {line.slice(2)}</p>;
            }
            if (line.trim() === "") {
              return <div key={i} className="h-2" />;
            }
            return <p key={i}>{line}</p>;
          })}
        </div>
      </div>
    );
  }

  function renderAskPanel() {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAsk();
            }}
            placeholder="Ask a question about your data..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-700"
          />
          <button
            onClick={handleAsk}
            disabled={!askQuestion.trim() || loading}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        {result && (
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-rose-400" />
              <h4 className="text-sm font-medium text-white">Answer</h4>
            </div>
            <div className="text-xs text-gray-300 whitespace-pre-wrap">
              {(result as unknown as AskResponse).answer}
            </div>
            {(result as unknown as AskResponse).references &&
              (result as unknown as AskResponse).references!.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <p className="text-[10px] text-gray-500 mb-1">References:</p>
                  {(result as unknown as AskResponse).references!.map((ref, i) => (
                    <p key={i} className="text-[10px] text-gray-400">&#8226; {ref}</p>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    );
  }

  function renderResult() {
    if (!activePanel || !result) return null;

    switch (activePanel) {
      case "profile":
        return renderProfile(result as unknown as ProfileResponse);
      case "insights":
        return renderInsights(result as unknown as InsightsResponse);
      case "trends":
        return renderTrends(result as unknown as TrendsResponse);
      case "anomalies":
        return renderAnomalies(result as unknown as AnomaliesResponse);
      case "compare":
        return renderCompare(result as unknown as CompareResponse);
      case "top-bottom":
        return renderTopBottom(result as unknown as TopBottomResponse);
      case "forecast":
        return renderForecast(result as unknown as ForecastResponse);
      case "chart-recommend":
        return renderChartRecommendations(result as unknown as ChartRecommendResponse);
      case "report":
        return renderReport(result as unknown as ReportResponse);
      default:
        return null;
    }
  }

  const panelLabels: Record<string, string> = {
    profile: "Auto Profile",
    insights: "Generate Insights",
    trends: "Find Trends",
    anomalies: "Detect Anomalies",
    compare: "Compare Groups",
    "top-bottom": "Top/Bottom N",
    forecast: "Forecast",
    "chart-recommend": "Chart Recommendations",
    report: "Generate Report",
  };

  const buttons = [
    { id: "profile", label: "Auto Profile", icon: User, color: "text-blue-400" },
    { id: "insights", label: "Generate Insights", icon: Lightbulb, color: "text-yellow-400" },
    { id: "trends", label: "Find Trends", icon: TrendingUp, color: "text-green-400" },
    { id: "anomalies", label: "Detect Anomalies", icon: AlertTriangle, color: "text-orange-400" },
    { id: "compare", label: "Compare Groups", icon: GitCompareArrows, color: "text-purple-400" },
    { id: "top-bottom", label: "Top/Bottom N", icon: ArrowUpDown, color: "text-cyan-400" },
    { id: "forecast", label: "Forecast", icon: CalendarDays, color: "text-pink-400" },
    { id: "chart-recommend", label: "Chart Recommendations", icon: BarChart3, color: "text-indigo-400" },
    { id: "report", label: "Generate Report", icon: FileText, color: "text-teal-400" },
    { id: "ask", label: "Ask Question", icon: MessageCircle, color: "text-rose-400" },
  ];

  function renderInputPanel() {
    if (showCompareInputs) {
      return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">Compare Groups</h4>
            <button onClick={() => setShowCompareInputs(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Group Column</label>
              <select
                value={compareGroupCol}
                onChange={(e) => setCompareGroupCol(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select column...</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Value Column</label>
              <select
                value={compareValueCol}
                onChange={(e) => setCompareValueCol(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select column...</option>
                {numericColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCompare}
              disabled={!compareGroupCol || !compareValueCol}
              className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Run Comparison
            </button>
          </div>
        </div>
      );
    }

    if (showTbInputs) {
      return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">Top/Bottom N</h4>
            <button onClick={() => setShowTbInputs(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Column</label>
              <select
                value={tbColumn}
                onChange={(e) => setTbColumn(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select column...</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Count (N)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={tbCount}
                onChange={(e) => setTbCount(Number(e.target.value))}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTopBottom(false)}
                disabled={!tbColumn}
                className="flex-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Top N
              </button>
              <button
                onClick={() => handleTopBottom(true)}
                disabled={!tbColumn}
                className="flex-1 px-3 py-1.5 bg-cyan-800 hover:bg-cyan-900 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Bottom N
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (showForecastInputs) {
      return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">Forecast</h4>
            <button onClick={() => setShowForecastInputs(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date Column</label>
              <select
                value={forecastDateCol}
                onChange={(e) => setForecastDateCol(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select column...</option>
                {dateColumns.length > 0
                  ? dateColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))
                  : allColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Value Column</label>
              <select
                value={forecastValueCol}
                onChange={(e) => setForecastValueCol(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select column...</option>
                {numericColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Forecast Periods</label>
              <input
                type="number"
                min={1}
                max={50}
                value={forecastPeriods}
                onChange={(e) => setForecastPeriods(Number(e.target.value))}
                className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <button
              onClick={handleForecast}
              disabled={!forecastDateCol || !forecastValueCol}
              className="w-full px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Run Forecast
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-medium text-white">Advanced Analysis</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activePanel === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => handleButtonClick(btn.id)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                ${
                  isActive
                    ? "bg-gray-700 border-gray-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-600"
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Icon className={`w-3.5 h-3.5 ${btn.color}`} />
              {btn.label}
            </button>
          );
        })}
      </div>

      {renderInputPanel()}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-400">Analyzing...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && result && activePanel && (
        <div className="max-h-[600px] overflow-y-auto pr-1">
          {renderResult()}
        </div>
      )}

      {!loading && !error && !result && activePanel === "ask" && (
        <div className="max-h-[600px] overflow-y-auto pr-1">
          {renderAskPanel()}
        </div>
      )}

      {!loading && !error && !result && activePanel !== "ask" && !showCompareInputs && !showTbInputs && !showForecastInputs && (
        <div className="text-center text-gray-500 py-8">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select an analysis type above to get started</p>
          <p className="text-xs text-gray-600 mt-1">
            Each button will run a different analysis on your dataset
          </p>
        </div>
      )}
    </div>
  );
}
