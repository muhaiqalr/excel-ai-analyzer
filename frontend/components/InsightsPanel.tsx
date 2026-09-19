"use client";

import { Lightbulb, Info } from "lucide-react";
import { InsightItem } from "@/types";

interface Props {
  insights: InsightItem[];
  loading: boolean;
}

export default function InsightsPanel({ insights, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-700 rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Insights</h3>
        </div>
        <p className="text-xs text-gray-500 mt-2">No insights available for this dataset</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-medium text-white">Automatic Insights</h3>
        <span className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
          {insights.length}
        </span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex gap-2 p-2.5 rounded-lg text-xs ${
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
              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
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
              <p className="font-medium text-gray-200 text-[11px]">{insight.title}</p>
              <p className="text-gray-400 mt-0.5">{insight.message}</p>
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
