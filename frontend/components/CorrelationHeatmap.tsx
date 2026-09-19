"use client";

import { useState } from "react";
import { Link, AlertCircle } from "lucide-react";
import { CorrelationResult } from "@/types";

interface Props {
  correlation: CorrelationResult | null;
  loading: boolean;
}

function getColor(val: number, isDiag: boolean): string {
  if (isDiag) return "bg-blue-600/40 text-blue-200";
  const abs = Math.abs(val);
  if (abs >= 0.7) return val > 0 ? "bg-green-600/40 text-green-200" : "bg-red-600/40 text-red-200";
  if (abs >= 0.4) return val > 0 ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300";
  if (abs >= 0.2) return "bg-gray-700/50 text-gray-300";
  return "bg-gray-800/50 text-gray-400";
}

function Legend() {
  return (
    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-red-600/40" />
        <span>Strong negative</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-gray-700/50" />
        <span>Weak</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-green-600/40" />
        <span>Strong positive</span>
      </div>
    </div>
  );
}

export default function CorrelationHeatmap({ correlation, loading }: Props) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-700 rounded mb-3" />
        <div className="h-40 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!correlation || correlation.numeric_columns.length < 2) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Correlation Matrix</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-3 h-3" />
          <span>Need at least 2 numeric columns for correlation analysis</span>
        </div>
      </div>
    );
  }

  const cols = correlation.numeric_columns;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Correlation Matrix</h3>
        </div>
        <span className="text-[10px] text-gray-500">
          {cols.length} numeric columns
        </span>
      </div>

      {correlation.strong_correlations.length > 0 && (
        <div className="mb-3 space-y-1">
          {correlation.strong_correlations.map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1">
              <span className="text-[11px] text-gray-300">
                {c.column1} &harr; {c.column2}
              </span>
              <span className={`text-[11px] font-mono ${c.correlation > 0 ? "text-green-400" : "text-red-400"}`}>
                r = {c.correlation.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left text-gray-500 min-w-[60px]" />
              {cols.map((col) => (
                <th key={col} className="p-1 text-center text-gray-500 min-w-[50px] max-w-[70px] truncate" title={col}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cols.map((row) => (
              <tr key={row}>
                <td className="p-1 text-gray-400 font-medium min-w-[60px] max-w-[70px] truncate" title={row}>
                  {row}
                </td>
                {cols.map((col) => {
                  const val = correlation.matrix[row]?.[col] ?? 0;
                  const isDiag = row === col;
                  const cellKey = `${row}-${col}`;
                  return (
                    <td
                      key={col}
                      className={`p-1 text-center font-mono rounded-sm cursor-default transition-colors ${getColor(val, isDiag)} ${
                        hoveredCell === cellKey ? "ring-1 ring-white/30" : ""
                      }`}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${row} × ${col}: ${val.toFixed(4)}`}
                    >
                      {isDiag ? "1.00" : val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Legend />
      <p className="text-[10px] text-gray-600 mt-1 italic">
        Correlation does not imply causation.
      </p>
    </div>
  );
}
