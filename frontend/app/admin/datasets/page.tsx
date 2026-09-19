"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { AdminDataset } from "@/types";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function AdminDatasetsPage() {
  const [datasets, setDatasets] = useState<AdminDataset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => { loadDatasets(); }, [page, search]);

  async function loadDatasets() {
    setLoading(true);
    try {
      const res = await adminAPI.listDatasets(page, pageSize, search);
      setDatasets(res.data.datasets);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dataset Monitoring</h1>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search datasets..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <span className="text-sm text-gray-400">{total} datasets</span>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">File</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Size</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Sheets</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Rows</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Version</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Analyses</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : datasets.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No datasets found</td></tr>
              ) : (
                datasets.map((d) => (
                  <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-white">{d.original_filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{d.owner_username}</td>
                    <td className="px-4 py-3 text-gray-300">{formatBytes(d.file_size)}</td>
                    <td className="px-4 py-3 text-gray-300">{d.total_sheets}</td>
                    <td className="px-4 py-3 text-gray-300">{d.total_rows}</td>
                    <td className="px-4 py-3 text-gray-300">v{d.dataset_version}</td>
                    <td className="px-4 py-3 text-gray-300">{d.analysis_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
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
