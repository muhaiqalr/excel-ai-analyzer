"use client";

import { useState, useEffect } from "react";
import { Brain, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { AdminAIUsage } from "@/types";

export default function AdminUsagePage() {
  const [usage, setUsage] = useState<AdminAIUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => { loadUsage(); }, [page]);

  async function loadUsage() {
    setLoading(true);
    try {
      const res = await adminAPI.listUsage(page, pageSize);
      setUsage(res.data.usage);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / pageSize);

  const totalRequests = usage.length;
  const failedRequests = usage.filter((u) => u.status === "error").length;
  const avgResponseTime = usage.filter((u) => u.response_time_ms !== null).length > 0
    ? Math.round(usage.filter((u) => u.response_time_ms !== null).reduce((sum, u) => sum + (u.response_time_ms ?? 0), 0) / usage.filter((u) => u.response_time_ms !== null).length)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <Brain className="w-6 h-6 text-purple-400" />
        AI Usage
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Total Requests</p>
          <p className="text-3xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Failed Requests</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{failedRequests}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Avg Response Time</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{avgResponseTime}ms</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">User</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Model</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Response Time</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Error</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : usage.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No usage records found</td></tr>
              ) : (
                usage.map((u) => (
                  <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-white">{u.username ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{u.model ?? "—"}</td>
                    <td className="px-4 py-3">
                      {u.status === "success" ? (
                        <span className="inline-flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs">Success</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs">Error</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {u.response_time_ms !== null ? `${u.response_time_ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                      {u.error_message ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
