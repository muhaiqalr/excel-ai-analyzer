"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Table2,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  AlertTriangle,
} from "lucide-react";
import { filesAPI } from "@/lib/api";
import { SheetAnalysis, Sheet } from "@/types";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  numeric: <Hash className="w-3.5 h-3.5 text-blue-400" />,
  text: <Type className="w-3.5 h-3.5 text-gray-400" />,
  categorical: <Type className="w-3.5 h-3.5 text-purple-400" />,
  date: <Calendar className="w-3.5 h-3.5 text-green-400" />,
  boolean: <ToggleLeft className="w-3.5 h-3.5 text-yellow-400" />,
};

const TYPE_COLORS: Record<string, string> = {
  numeric: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  text: "bg-gray-500/10 text-gray-300 border-gray-500/20",
  categorical: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  date: "bg-green-500/10 text-green-300 border-green-500/20",
  boolean: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
};

interface Props {
  fileId: string;
  sheets: Sheet[];
  activeSheet: string;
  onSheetSelect: (sheetName: string) => void;
}

export default function DataPreview({
  fileId,
  sheets,
  activeSheet,
  onSheetSelect,
}: Props) {
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (fileId && activeSheet) {
      loadAnalysis(fileId, activeSheet);
    }
  }, [fileId, activeSheet]);

  async function loadAnalysis(id: string, sheet: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await filesAPI.sheetAnalysis(id, sheet);
      setAnalysis(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load sheet analysis";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function toggleColumn(name: string) {
    setExpandedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg m-4">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (!analysis) return null;

  const totalMissing = Object.values(analysis.missing_values).reduce(
    (sum, v) => sum + v.count,
    0
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Worksheet Selector */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-white mb-3">
          Select Worksheet
        </h3>
        <div className="flex flex-wrap gap-2">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              onClick={() => onSheetSelect(sheet.sheet_name)}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                activeSheet === sheet.sheet_name
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600"
              }`}
            >
              <span className="font-medium">{sheet.sheet_name}</span>
              <span className="ml-2 text-xs opacity-70">
                {sheet.row_count} rows x {sheet.column_count} cols
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
          <p className="text-xs text-gray-400">Rows</p>
          <p className="text-lg font-bold text-white">
            {analysis.row_count.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
          <p className="text-xs text-gray-400">Columns</p>
          <p className="text-lg font-bold text-white">
            {analysis.column_count}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
          <p className="text-xs text-gray-400">Missing Values</p>
          <p
            className={`text-lg font-bold ${
              totalMissing > 0 ? "text-yellow-400" : "text-green-400"
            }`}
          >
            {totalMissing.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
          <p className="text-xs text-gray-400">File</p>
          <p className="text-sm font-medium text-white truncate">
            {analysis.filename}
          </p>
        </div>
      </div>

      {/* Column Details */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-white mb-3">
          Column Analysis ({analysis.column_names.length} columns)
        </h3>
        <div className="space-y-2">
          {analysis.column_details.map((col) => {
            const isExpanded = expandedColumns.has(col.name);
            const hasMissing = col.missing_count > 0;
            const typeColor =
              TYPE_COLORS[col.detected_type] || TYPE_COLORS.text;

            return (
              <div
                key={col.name}
                className="border border-gray-800 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleColumn(col.name)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors text-left"
                >
                  {TYPE_ICONS[col.detected_type] || TYPE_ICONS.text}
                  <span className="text-sm text-white font-medium flex-1 truncate">
                    {col.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}
                  >
                    {col.detected_type}
                  </span>
                  {hasMissing && (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3" />
                      {col.missing_count} missing
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {col.unique_count} unique
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <span className="text-gray-400">Total: </span>
                        <span className="text-white">{col.total_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Non-null: </span>
                        <span className="text-white">{col.non_null_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Missing: </span>
                        <span
                          className={
                            hasMissing ? "text-yellow-400" : "text-green-400"
                          }
                        >
                          {col.missing_count} ({col.missing_percentage}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Unique: </span>
                        <span className="text-white">{col.unique_count}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Preview */}
      {analysis.preview.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-white mb-3">
            <Table2 className="w-4 h-4 inline mr-1" />
            Data Preview (first {analysis.preview.length} rows)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  {analysis.column_names.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.preview.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    {analysis.column_names.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[200px] truncate"
                      >
                        {row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : (
                            <span className="text-gray-600 italic">null</span>
                          )}
                      </td>
                    ))}
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
