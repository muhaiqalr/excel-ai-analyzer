"use client";

import { useState, useEffect } from "react";
import { Heart, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { AdminHealth } from "@/types";

const statusConfig = {
  ok: { icon: CheckCircle, color: "text-green-400", dot: "bg-green-500", label: "Operational" },
  error: { icon: XCircle, color: "text-red-400", dot: "bg-red-500", label: "Down" },
  "not configured": { icon: AlertTriangle, color: "text-yellow-400", dot: "bg-yellow-500", label: "Not Configured" },
};

type StatusKey = keyof typeof statusConfig;

const cards: { key: keyof AdminHealth; label: string; description: string }[] = [
  { key: "backend", label: "Backend", description: "API server status" },
  { key: "database", label: "Database", description: "PostgreSQL connection" },
  { key: "ai_provider", label: "AI Provider", description: "Gemini API status" },
  { key: "storage", label: "Storage", description: "File storage system" },
];

export default function AdminHealthPage() {
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadHealth(); }, []);

  async function loadHealth() {
    setLoading(true);
    try {
      const res = await adminAPI.health();
      setHealth(res.data);
    } catch {} finally { setLoading(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await adminAPI.health();
      setHealth(res.data);
    } catch {} finally { setRefreshing(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Heart className="w-6 h-6 text-green-400" />
          System Health
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading health status...</div>
      ) : !health ? (
        <div className="text-center text-gray-500 py-12">Failed to load health status</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(({ key, label, description }) => {
            const status = (health[key] as string).toLowerCase() as StatusKey;
            const config = statusConfig[status] ?? statusConfig.error;
            const Icon = config.icon;

            return (
              <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">{label}</h2>
                  <div className={`flex items-center gap-2 ${config.color}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-2">{description}</p>
                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
