"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Shield,
  BarChart3,
} from "lucide-react";
import { filesAPI, authAPI } from "@/lib/api";
import { FileItem, User } from "@/types";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
    loadUser();
    const handleFocus = () => { loadData(); loadUser(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  async function loadUser() {
    try {
      const res = await authAPI.me();
      setUser(res.data);
    } catch {}
  }

  async function loadData() {
    try {
      const res = await filesAPI.list();
      setFiles(res.data);
    } catch {}
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await filesAPI.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      alert("Failed to delete file");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth");
  }

  return (
    <div
      className={`h-screen bg-gray-900 text-white flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm">XELENS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Main Navigation */}
          <div className="p-2 space-y-1">
            <button
              onClick={() => router.push("/dashboard")}
              className={`flex items-center gap-2 w-full p-2 rounded text-sm ${
                pathname === "/dashboard" && !window.location.search.includes("fileId")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </button>

            {files.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2 mb-1">Your Files</p>
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer group ${
                      pathname.includes(`fileId=${file.id}`)
                        ? "bg-gray-700 text-white"
                        : "hover:bg-gray-800 text-gray-300"
                    }`}
                    onClick={() => router.push(`/dashboard?fileId=${file.id}`)}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="truncate text-xs">{file.original_filename}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                      className="p-1 rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History Link */}
          <div className="p-2 border-t border-gray-700">
            <button
              onClick={() => router.push("/history")}
              className={`flex items-center gap-2 w-full p-2 rounded text-sm ${
                pathname === "/history"
                  ? "bg-gray-700 text-white"
                  : "hover:bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
              Analysis History
            </button>
          </div>
        </div>
      )}

      {/* Admin + Logout */}
      <div className="p-2 border-t border-gray-700 space-y-1">
        {user?.role === "admin" && !collapsed && (
          <button
            onClick={() => router.push("/admin")}
            className={`flex items-center gap-2 w-full p-2 rounded text-sm ${
              pathname.startsWith("/admin")
                ? "bg-yellow-600 text-white"
                : "hover:bg-gray-800 text-yellow-400"
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full p-2 rounded hover:bg-gray-800 text-sm text-gray-400 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && "Logout"}
        </button>
      </div>
    </div>
  );
}
