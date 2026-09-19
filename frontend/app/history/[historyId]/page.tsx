"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Loader2,
  Clock,
  FileSpreadsheet,
  MessageSquare,
  ArrowLeft,
  AlertCircle,
  Calendar,
  BarChart3,
  Hash,
  Database,
} from "lucide-react";
import { historyAPI } from "@/lib/api";
import { HistoryItem } from "@/types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-white mt-0.5">{value}</p>
    </div>
  );
}

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const historyId = params.historyId as string;
  const [record, setRecord] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (historyId) loadRecord();
  }, [historyId]);

  async function loadRecord() {
    setLoading(true);
    setError(null);
    try {
      const res = await historyAPI.get(historyId);
      setRecord(res.data);
    } catch {
      setError("Failed to load history record. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 p-6 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-300 text-center">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={loadRecord}
              className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/history")}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Back to History
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!record) return null;

  const stats = record.statistics_snapshot as Record<string, unknown> | null;
  const fullStats = (stats?.full_statistics ?? null) as Record<string, unknown> | null;
  const overview = (fullStats?.overview ?? null) as Record<string, unknown> | null;
  const chartData = record.chart_config as Record<string, unknown> | null;
  const dataset = record.dataset_snapshot as Record<string, unknown> | null;
  const columnsData = (fullStats?.columns ?? null) as Record<string, Record<string, unknown>> | null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => router.push("/history")}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-2 sm:mb-3 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to History
          </button>
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <h1 className="text-lg sm:text-xl font-bold text-white">Analysis Detail</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm text-gray-300">{record.filename}</span>
            {record.dataset_version && (
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                v{record.dataset_version}
              </span>
            )}
            <span className="text-gray-600">|</span>
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-500">
              {formatDate(record.created_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Question */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-medium text-white">Analysis Question</h2>
          </div>
          <p className="text-sm text-gray-300 bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
            {record.analysis_question}
          </p>
        </div>

        {/* AI Response */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-medium text-white">AI Analysis Response</h2>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
            <div className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
              {record.ai_response}
            </div>
          </div>
        </div>

        {/* Statistics Snapshot */}
        {overview && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-medium text-white">Statistics Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Total Rows" value={String(overview.total_rows ?? 0)} />
              <StatCard label="Total Columns" value={String(overview.total_columns ?? 0)} />
              <StatCard label="Total Cells" value={String(overview.total_cells ?? 0)} />
              <StatCard label="Missing Cells" value={String(overview.missing_cells ?? 0)} />
              <StatCard label="Missing %" value={`${overview.missing_percentage ?? 0}%`} />
              <StatCard label="Numeric Columns" value={String(overview.numeric_columns ?? 0)} />
              <StatCard label="Text Columns" value={String(overview.text_columns ?? 0)} />
              <StatCard label="Date Columns" value={String(overview.date_columns ?? 0)} />
              <StatCard label="Categorical" value={String(overview.categorical_columns ?? 0)} />
              <StatCard label="Boolean" value={String(overview.boolean_columns ?? 0)} />
            </div>

            {/* Column Details */}
            {columnsData && Object.keys(columnsData).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-gray-400 mb-2">Column Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="p-2 text-left text-gray-400">Column</th>
                        <th className="p-2 text-left text-gray-400">Type</th>
                        <th className="p-2 text-right text-gray-400">Count</th>
                        <th className="p-2 text-right text-gray-400">Missing</th>
                        <th className="p-2 text-right text-gray-400">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(columnsData).map(([colName, colStats]) => (
                        <tr key={colName} className="border-b border-gray-800">
                          <td className="p-2 text-white font-mono">{colName}</td>
                          <td className="p-2 text-gray-400">{String(colStats.type)}</td>
                          <td className="p-2 text-right text-gray-300">
                            {String(colStats.count)}
                          </td>
                          <td className="p-2 text-right text-gray-300">
                            {String(colStats.missing_count)}
                          </td>
                          <td className="p-2 text-right text-gray-300">
                            {String(colStats.unique_count ?? "-")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart Config */}
        {chartData && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-medium text-white">Chart Data</h2>
            </div>
            <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
              {(() => {
                const req = chartData.chart_request as Record<string, unknown> | null;
                if (!req) return null;
                return (
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="text-gray-500">Type:</span>
                    <span>{String(req.chart_type ?? "")}</span>
                    {req.x_column ? (
                      <>
                        <span className="text-gray-500">| X:</span>
                        <span>{String(req.x_column)}</span>
                      </>
                    ) : null}
                    {req.y_column ? (
                      <>
                        <span className="text-gray-500">| Y:</span>
                        <span>{String(req.y_column)}</span>
                      </>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Dataset Snapshot */}
        {dataset && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-medium text-white">Dataset Snapshot</h2>
            </div>
            <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
              <div className="flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Rows: </span>
                  <span className="text-white">{String(dataset.row_count)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Columns: </span>
                  <span className="text-white">{String(Array.isArray(dataset.columns) ? dataset.columns.length : 0)}</span>
                </div>
              </div>
              {Array.isArray(dataset.columns) && dataset.columns.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-gray-500">Column names:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(dataset.columns as unknown[]).map((col: unknown) => (
                      <span
                        key={String(col)}
                        className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300"
                      >
                        {String(col)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => router.push(`/dashboard?fileId=${record.file_id}`)}
            className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Open in Dashboard
          </button>
          <button
            onClick={() => router.push("/history")}
            className="px-4 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Back to History
          </button>
        </div>
      </div>
    </div>
  );
}
