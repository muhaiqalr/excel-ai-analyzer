"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Clock,
  FileSpreadsheet,
  MessageSquare,
  Trash2,
  Eye,
  AlertCircle,
  Search,
  Calendar,
} from "lucide-react";
import { historyAPI } from "@/lib/api";
import { HistoryListItem } from "@/types";
import Sidebar from "@/components/Sidebar";

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await historyAPI.list();
      setRecords(res.data);
    } catch {
      setError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    setDeleting(id);
    try {
      await historyAPI.delete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = records.filter(
    (r) =>
      r.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.analysis_question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white">Analysis History</h1>
          </div>
          <p className="text-sm text-gray-400">Your past AI analysis sessions</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
                <button onClick={loadHistory} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded">
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && records.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Clock className="w-12 h-12 text-gray-600" />
              <p className="text-sm text-gray-400">No analysis history yet</p>
              <button onClick={() => router.push("/dashboard")} className="mt-2 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Go to Dashboard
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((record) => (
                <div key={record.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{record.filename}</span>
                      </div>
                      <div className="flex items-start gap-2 mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-300 line-clamp-2">{record.analysis_question}</p>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 ml-5">{record.ai_response_preview}</p>
                      <div className="flex items-center gap-1 mt-1 ml-5">
                        <Calendar className="w-3 h-3 text-gray-600" />
                        <span className="text-[10px] text-gray-500">{formatDate(record.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => router.push(`/history/${record.id}`)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button onClick={() => handleDelete(record.id)} disabled={deleting === record.id} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded disabled:opacity-50">
                        {deleting === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
