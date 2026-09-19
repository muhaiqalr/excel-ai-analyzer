"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  BarChart3,
  AlertTriangle,
  Link,
  Target,
  Lightbulb,
  Info,
  X,
} from "lucide-react";
import {
  FullStatistics,
  ColumnStatistics,
  CorrelationResult,
  OutlierResult,
  InsightItem,
  DatasetOverview,
} from "@/types";

interface Props {
  stats: FullStatistics | null;
  loading: boolean;
}

function StatValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  );
}

function OverviewCards({ overview }: { overview: DatasetOverview }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
      <h3 className="text-sm font-medium text-white mb-2">Dataset Overview</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-bold text-blue-400">{overview.total_rows}</p>
          <p className="text-xs text-gray-400">Rows</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-purple-400">{overview.total_columns}</p>
          <p className="text-xs text-gray-400">Columns</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-400">{overview.total_cells}</p>
          <p className="text-xs text-gray-400">Total Cells</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 mt-3 pt-3 border-t border-gray-700">
        <div className="text-center">
          <p className="text-sm font-bold text-blue-300">{overview.numeric_columns}</p>
          <p className="text-[10px] text-gray-500">Numeric</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-green-300">{overview.text_columns}</p>
          <p className="text-[10px] text-gray-500">Text</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-yellow-300">{overview.date_columns}</p>
          <p className="text-[10px] text-gray-500">Date</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-purple-300">{overview.categorical_columns}</p>
          <p className="text-[10px] text-gray-500">Categorical</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-cyan-300">{overview.boolean_columns}</p>
          <p className="text-[10px] text-gray-500">Boolean</p>
        </div>
      </div>
      {overview.missing_cells > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-amber-300">
              {overview.missing_cells} missing cells ({overview.missing_percentage}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnCard({ name, stats }: { name: string; stats: ColumnStatistics }) {
  const [expanded, setExpanded] = useState(false);

  const icon =
    stats.type === "numeric" ? (
      <Hash className="w-3.5 h-3.5 text-blue-400" />
    ) : stats.type === "date" ? (
      <Calendar className="w-3.5 h-3.5 text-green-400" />
    ) : stats.type === "categorical" ? (
      <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
    ) : stats.type === "boolean" ? (
      <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
    ) : (
      <Type className="w-3.5 h-3.5 text-gray-400" />
    );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-gray-700 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        {icon}
        <span className="text-sm font-medium text-white truncate flex-1">{name}</span>
        <span className="text-xs text-gray-500">{stats.type}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-0.5 border-t border-gray-700 pt-2">
          <StatValue label="Count" value={stats.count} />
          <StatValue
            label="Missing"
            value={`${stats.missing_count} (${stats.missing_pct}%)`}
          />

          {stats.type === "numeric" && (
            <>
              <StatValue label="Sum" value={stats.sum?.toFixed(2)} />
              <StatValue label="Mean" value={stats.mean?.toFixed(2)} />
              <StatValue label="Median" value={stats.median?.toFixed(2)} />
              <StatValue label="Min" value={stats.min?.toFixed(2)} />
              <StatValue label="Max" value={stats.max?.toFixed(2)} />
              <StatValue label="Range" value={stats.range?.toFixed(2)} />
              <StatValue label="Std Dev" value={stats.std?.toFixed(2)} />
              <StatValue label="Variance" value={stats.variance?.toFixed(2)} />
              <StatValue label="Q1" value={stats.q1?.toFixed(2)} />
              <StatValue label="Q3" value={stats.q3?.toFixed(2)} />
              <StatValue label="IQR" value={stats.iqr?.toFixed(2)} />
            </>
          )}

          {stats.type === "boolean" && (
            <>
              <StatValue label="True Count" value={stats.true_count} />
              <StatValue label="False Count" value={stats.false_count} />
              <StatValue label="True %" value={`${stats.true_pct}%`} />
            </>
          )}

          {stats.type === "categorical" && (
            <>
              <StatValue label="Unique" value={stats.unique_count} />
              <StatValue label="Most Common" value={stats.most_common} />
              <StatValue label="Frequency" value={stats.most_common_count} />
              {stats.frequency_distribution && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Top values:</p>
                  {Object.entries(stats.frequency_distribution)
                    .slice(0, 5)
                    .map(([key, count]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-300 truncate max-w-[120px]">{key}</span>
                        <span className="text-gray-500">
                          {count} ({stats.percentages?.[key]}%)
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          {stats.type === "date" && (
            <>
              <StatValue label="Earliest" value={stats.earliest?.split(" ")[0]} />
              <StatValue label="Latest" value={stats.latest?.split(" ")[0]} />
              <StatValue label="Range (days)" value={stats.range_days} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CorrelationPanel({ correlation }: { correlation: CorrelationResult }) {
  const [expanded, setExpanded] = useState(false);

  if (correlation.numeric_columns.length < 2) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Correlation</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Not enough numeric columns for correlation analysis (need at least 2).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-gray-700 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        <Link className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">Correlation</span>
        <span className="text-xs text-gray-500">
          {correlation.numeric_columns.length} numeric columns
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-2">
          {correlation.strong_correlations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Strong Correlations:</p>
              {correlation.strong_correlations.map((c, i) => (
                <div key={i} className="bg-gray-900 rounded p-2 mb-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white">
                      {c.column1} &harr; {c.column2}
                    </span>
                    <span
                      className={
                        c.correlation > 0 ? "text-green-400" : "text-red-400"
                      }
                    >
                      r = {c.correlation.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">{c.strength}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mb-1">Correlation Matrix:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="p-1 text-left text-gray-500"></th>
                  {correlation.numeric_columns.map((col) => (
                    <th key={col} className="p-1 text-center text-gray-500 max-w-[60px] truncate">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation.numeric_columns.map((row) => (
                  <tr key={row}>
                    <td className="p-1 text-gray-400 max-w-[60px] truncate">{row}</td>
                    {correlation.numeric_columns.map((col) => {
                      const val = correlation.matrix[row]?.[col] ?? 0;
                      const absVal = Math.abs(val);
                      const bg =
                        row === col
                          ? "bg-blue-900/50"
                          : absVal >= 0.7
                            ? "bg-green-900/50"
                            : absVal >= 0.4
                              ? "bg-yellow-900/30"
                              : "";
                      return (
                        <td key={col} className={`p-1 text-center text-gray-300 ${bg}`}>
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 italic">
            Correlation does not imply causation.
          </p>
        </div>
      )}
    </div>
  );
}

function OutlierPanel({ outliers }: { outliers: Record<string, OutlierResult> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(outliers);

  if (entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Outliers</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2">No numeric columns with detectable outliers.</p>
      </div>
    );
  }

  const totalOutliers = entries.reduce((sum, [, v]) => sum + v.outlier_count, 0);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-gray-700 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        <Target className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-white">Outliers</span>
        <span className="text-xs text-gray-500">
          {totalOutliers} potential outliers across {entries.length} columns
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-2 space-y-2">
          {entries.map(([col, info]) => (
            <div key={col} className="bg-gray-900 rounded p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-white font-medium">{col}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    info.outlier_count > 0
                      ? "bg-amber-900/50 text-amber-300"
                      : "bg-green-900/50 text-green-300"
                  }`}
                >
                  {info.outlier_count} outliers ({info.outlier_percentage}%)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div>
                  <span className="text-gray-500">Q1:</span>{" "}
                  <span className="text-gray-300">{info.q1.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Q3:</span>{" "}
                  <span className="text-gray-300">{info.q3.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">IQR:</span>{" "}
                  <span className="text-gray-300">{info.iqr.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Lower:</span>{" "}
                  <span className="text-gray-300">{info.lower_bound.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Upper:</span>{" "}
                  <span className="text-gray-300">{info.upper_bound.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>{" "}
                  <span className="text-gray-300">{info.total_count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsPanel({ insights }: { insights: InsightItem[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-medium text-white">Automatic Insights</h3>
      </div>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex gap-2 p-2 rounded text-xs ${
              insight.type === "warning"
                ? "bg-amber-900/20 border border-amber-800/30"
                : insight.type === "correlation"
                  ? "bg-blue-900/20 border border-blue-800/30"
                  : insight.type === "outlier"
                    ? "bg-orange-900/20 border border-orange-800/30"
                    : "bg-gray-900/50 border border-gray-700/50"
            }`}
          >
            <Info
              className={`w-3 h-3 mt-0.5 shrink-0 ${
                insight.type === "warning"
                  ? "text-amber-400"
                  : insight.type === "correlation"
                    ? "text-blue-400"
                    : insight.type === "outlier"
                      ? "text-orange-400"
                      : "text-gray-400"
              }`}
            />
            <div>
              <p className="text-gray-300">{insight.message}</p>
              {insight.note && (
                <p className="text-[10px] text-gray-500 italic mt-0.5">{insight.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPanel({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p className="text-sm">No statistics available</p>
        <p className="text-xs text-gray-600 mt-1">
          Edit data in the Editor tab to see real-time statistics
        </p>
      </div>
    );
  }

  const columns = Object.entries(stats.columns);

  return (
    <div className="p-4 space-y-3">
      <OverviewCards overview={stats.overview} />
      <InsightsPanel insights={stats.insights} />
      <CorrelationPanel correlation={stats.correlation} />
      <OutlierPanel outliers={stats.outliers} />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white px-1">Column Statistics</h3>
        {columns.map(([name, colStats]) => (
          <ColumnCard key={name} name={name} stats={colStats} />
        ))}
      </div>
    </div>
  );
}
