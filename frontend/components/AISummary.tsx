"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { analysisAPI } from "@/lib/api";

interface Props {
  fileId: string;
  columns: string[];
  rows: unknown[][];
  datasetVersion: number;
}

export default function AISummary({ fileId, columns, rows, datasetVersion }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = useCallback(async () => {
    if (columns.length === 0 || rows.length === 0) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analysisAPI.chat(
        fileId,
        "Generate a brief natural-language summary of this dataset. Focus on what the data shows - important patterns, highest/lowest categories, key trends. Do NOT mention row counts, column counts, or technical spreadsheet details. Write in the same language as the data. Keep it to 3-5 sentences.",
        undefined,
        columns,
        rows,
        datasetVersion
      );
      setSummary(res.data.content);
    } catch (err: unknown) {
      console.error("AI Summary error:", err);
      const msg = err instanceof Error ? err.message : "Unable to generate summary.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fileId, columns, rows, datasetVersion]);

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      const timeout = setTimeout(generateSummary, 500);
      return () => clearTimeout(timeout);
    }
  }, [columns, rows, datasetVersion, generateSummary]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">AI Summary</h3>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading || columns.length === 0}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          title="Regenerate"
        >
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !summary ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Analyzing data...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : summary ? (
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{summary}</p>
      ) : (
        <p className="text-xs text-gray-500">Upload data to see AI summary</p>
      )}
    </div>
  );
}
