"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  MessageSquare,
  BarChart3,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  History,
  Pencil,
  Shield,
} from "lucide-react";
import { filesAPI, analysisAPI, authAPI } from "@/lib/api";
import { FileItem, AnalysisSession, User } from "@/types";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"files" | "history">("files");
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
    } catch {
      // silently fail
    }
  }

  async function loadData() {
    try {
      const [filesRes, sessionsRes] = await Promise.all([
        filesAPI.list(),
        analysisAPI.listSessions(),
      ]);
      setFiles(filesRes.data);
      setSessions(sessionsRes.data);
    } catch {
      // silently fail
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await filesAPI.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (selectedFileId === fileId) setSelectedFileId(null);
    } catch {
      alert("Failed to delete file");
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Delete this analysis session?")) return;
    try {
      await analysisAPI.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      alert("Failed to delete session");
    }
  }

  async function handleRenameFile(fileId: string, currentName: string) {
    const newName = prompt("Rename file:", currentName);
    if (!newName || newName === currentName) return;
    try {
      await filesAPI.renameFile(fileId, newName);
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, original_filename: newName } : f));
    } catch {
      alert("Failed to rename file");
    }
  }

  async function handleNewAnalysis(fileId: string) {
    try {
      const res = await analysisAPI.createSession(fileId);
      setSessions((prev) => [res.data, ...prev]);
      router.push(`/analysis/${res.data.id}`);
    } catch {
      alert("Failed to create analysis session");
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
        collapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <span className="font-bold text-xs sm:text-sm">SISTEM XELENS JHEAINS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 p-2 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === "files"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" />
              Files ({files.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 p-2 text-xs font-medium flex items-center justify-center gap-1 ${
                activeTab === "history"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <History className="w-3 h-3" />
              History ({sessions.length})
            </button>
          </div>

          {/* Files List */}
          {activeTab === "files" && (
            <div className="flex-1 overflow-y-auto p-2">
              <div
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 p-2 rounded bg-blue-600 hover:bg-blue-700 cursor-pointer mb-2 text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload New File
              </div>
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`p-2 rounded mb-1 cursor-pointer text-sm group ${
                    selectedFileId === file.id
                      ? "bg-gray-700"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => {
                    setSelectedFileId(file.id);
                    router.push(`/dashboard?fileId=${file.id}`);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="truncate">{file.original_filename}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameFile(file.id, file.original_filename);
                        }}
                        className="p-1 rounded hover:bg-gray-600"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNewAnalysis(file.id);
                        }}
                        className="p-1 rounded hover:bg-gray-600"
                        title="New Analysis"
                      >
                        <MessageSquare className="w-3 h-3 text-blue-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="p-1 rounded hover:bg-gray-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 ml-6">
                    {file.total_rows} rows x {file.total_columns} cols
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-4">
                  No files uploaded yet
                </p>
              )}
            </div>
          )}

          {/* History List */}
          {activeTab === "history" && (
            <div className="flex-1 overflow-y-auto p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-2 rounded mb-1 cursor-pointer text-sm group ${
                    pathname === `/analysis/${session.id}`
                      ? "bg-gray-700"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => router.push(`/analysis/${session.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="p-1 rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 ml-6 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(session.updated_at).toLocaleDateString()}
                    <span className="ml-1">
                      ({session.message_count} msgs)
                    </span>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-4">
                  No analysis sessions yet
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* History Page Link */}
      {!collapsed && (
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
      )}

      {/* Admin Link (only for admin users) */}
      {user?.role === "admin" && !collapsed && (
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={() => router.push("/admin")}
            className={`flex items-center gap-2 w-full p-2 rounded text-sm ${
              pathname.startsWith("/admin")
                ? "bg-yellow-600 text-white"
                : "hover:bg-gray-800 text-yellow-400 hover:text-yellow-300"
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin Panel
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="p-2 border-t border-gray-700">
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

