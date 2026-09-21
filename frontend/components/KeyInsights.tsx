"use client";

import { useState, useEffect, useCallback } from "react";
import { Lightbulb, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { analysisAPI } from "@/lib/api";

interface Insight {
  text: string;
}

interface Props {
  fileId: string;
  columns: string[];
  rows: unknown[][];
}

export default function KeyInsights({ fileId, columns, rows }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = useCallback(async () => {
    if (columns.length === 0 || rows.length === 0) {
      setInsights([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analysisAPI.chat(
        fileId,
        "List the 5 most important insights from this data. For each insight, write one concise sentence. Focus on patterns, comparisons, trends, highest/lowest values, and anything noteworthy. Do NOT mention row/column counts or technical details. Return each insight on a new line starting with '- '.",
        undefined,
        columns,
        rows
      );
      const lines = res.data.content.split("\n").filter((l: string) => l.trim().startsWith("-"));
      const parsed = lines.map((line: string) => ({ text: line.replace(/^-\s*/, "").trim() })).filter((i: Insight) => i.text.length > 0);
      setInsights(parsed.slice(0, 5));
    } catch (err: unknown) {
      console.error("Key Insights error:", err);
      const msg = err instanceof Error ? err.message : "Unable to generate insights.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fileId, columns, rows]);

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      const timeout = setTimeout(generateInsights, 2000);
      return () => clearTimeout(timeout);
    }
  }, [columns, rows, generateInsights]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-medium text-white">Key Insights</h3>
        </div>
        <button
          onClick={generateInsights}
          disabled={loading || columns.length === 0}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          title="Regenerate"
        >
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Finding insights...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : insights.length > 0 ? (
        <ul className="space-y-2">
          {insights.map((insight, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-gray-300">
              <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
              <span className="leading-relaxed">{insight.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">Upload data to see insights</p>
      )}
    </div>
  );
}
