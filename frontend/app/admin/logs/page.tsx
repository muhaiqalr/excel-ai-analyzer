"use client";

import { useState, useEffect } from "react";
import { Activity, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { AdminSystemLog } from "@/types";

const eventTypes = ["", "auth", "upload", "analysis", "ai_error", "system"];

const eventBadgeColors: Record<string, string> = {
  auth: "bg-blue-900/50 text-blue-400",
  upload: "bg-cyan-900/50 text-cyan-400",
  analysis: "bg-purple-900/50 text-purple-400",
  ai_error: "bg-red-900/50 text-red-400",
  system: "bg-gray-800 text-gray-400",
};

const statusBadgeColors: Record<string, string> = {
  success: "bg-green-900/50 text-green-400",
  error: "bg-red-900/50 text-red-400",
  warning: "bg-yellow-900/50 text-yellow-400",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminSystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("");
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [eventType]);
  useEffect(() => { loadLogs(); }, [page, eventType]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await adminAPI.listLogs(page, pageSize, eventType);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-6 h-6 text-cyan-400" />
          System Logs
        </h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et === "" ? "All Events" : et}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Event Type</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">User</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${eventBadgeColors[log.event_type] ?? "bg-gray-800 text-gray-400"}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{log.username ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusBadgeColors[log.status] ?? "bg-gray-800 text-gray-400"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-[300px] truncate">
                      {log.message}
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
