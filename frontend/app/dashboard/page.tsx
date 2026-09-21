"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  X,
  Save,
  RefreshCw,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import FileUpload from "@/components/FileUpload";
import ExcelEditor from "@/components/ExcelEditor";
import AISummary from "@/components/AISummary";
import RelevantCharts from "@/components/RelevantCharts";
import KeyInsights from "@/components/KeyInsights";
import ParticleDrift from "@/components/ui/particle-drift";
import { filesAPI, historyAPI } from "@/lib/api";
import { FileItem } from "@/types";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileId = searchParams.get("fileId");

  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [datasetVersion, setDatasetVersion] = useState(1);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);

  const [currentColumns, setCurrentColumns] = useState<string[]>([]);
  const [currentRows, setCurrentRows] = useState<unknown[][]>([]);

  useEffect(() => {
    if (fileId) loadFile(fileId);
    else {
      setFile(null);
      setError(null);
      setCurrentColumns([]);
      setCurrentRows([]);
      loadRecentFiles();
    }
  }, [fileId]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  async function loadRecentFiles() {
    try {
      const res = await filesAPI.list();
      setRecentFiles(res.data.slice(0, 6));
    } catch {}
  }

  async function loadFile(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await filesAPI.get(id);
      setFile(res.data);
      setDatasetVersion(res.data.dataset_version || 1);
    } catch {
      setError("Failed to load file. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleUnsavedChange(hasUnsaved: boolean) {
    setHasUnsavedChanges(hasUnsaved);
  }

  function handleDataChanged(data?: { columns: string[]; rows: unknown[][] }) {
    if (data && data.columns.length > 0 && data.rows.length > 0) {
      setCurrentColumns(data.columns);
      setCurrentRows(data.rows);
    }
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const origRes = await filesAPI.data(file.id, "Sheet1", 1, 10000);
      const origData = origRes.data;
      const origColumns: string[] = origRes.data.columns;

      const changes: { sheet_name: string; row: number; column: string; value: unknown }[] = [];
      const structural: { operation: string; sheet_name: string; index?: number; column_name?: string }[] = [];

      for (let r = 0; r < currentRows.length; r++) {
        for (let c = 0; c < currentColumns.length; c++) {
          const newVal = currentRows[r]?.[c] ?? null;
          const origColIdx = origColumns.indexOf(currentColumns[c]);
          let origVal: unknown = null;
          if (origColIdx !== -1 && r < origData.rows.length) {
            origVal = origData.rows[r][origColIdx];
            if (origVal === "" || origVal === null || origVal === undefined) origVal = null;
          }
          if (String(newVal) !== String(origVal)) {
            changes.push({ sheet_name: "Sheet1", row: r, column: currentColumns[c], value: newVal });
          }
        }
      }

      if (currentColumns.length > origColumns.length) {
        for (let c = origColumns.length; c < currentColumns.length; c++) {
          structural.push({ operation: "add_column", sheet_name: "Sheet1", index: c, column_name: currentColumns[c] });
        }
      }
      const removedCols = origColumns.filter((c) => !currentColumns.includes(c));
      for (const col of removedCols) {
        structural.push({ operation: "delete_column", sheet_name: "Sheet1", column_name: col });
      }
      if (currentRows.length > origData.rows.length) {
        for (let r = origData.rows.length; r < currentRows.length; r++) {
          structural.push({ operation: "add_row", sheet_name: "Sheet1", index: r });
          for (let c = 0; c < currentColumns.length; c++) {
            const val = currentRows[r]?.[c];
            if (val !== null && val !== undefined && val !== "") {
              changes.push({ sheet_name: "Sheet1", row: r, column: currentColumns[c], value: val });
            }
          }
        }
      } else if (currentRows.length < origData.rows.length) {
        for (let r = origData.rows.length - 1; r >= currentRows.length; r--) {
          structural.push({ operation: "delete_row", sheet_name: "Sheet1", index: r });
        }
      }

      if (changes.length > 0 || structural.length > 0) {
        const saveRes = await filesAPI.saveData(file.id, { changes, structural, dataset_version: datasetVersion });
        setDatasetVersion(saveRes.data.dataset_version);
        setFile((prev) => prev ? { ...prev, dataset_version: saveRes.data.dataset_version } : prev);
        setSaveMessage("Changes saved successfully.");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage("No changes to save.");
        setTimeout(() => setSaveMessage(null), 3000);
      }

      setHasUnsavedChanges(false);
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (apiErr.response?.status === 409) {
        setError(apiErr.response?.data?.detail || "Version conflict. Reloading file...");
        await loadFile(file.id);
      } else {
        setError("Failed to save changes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleUpload(newFile: FileItem) {
    setFile(newFile);
    setDatasetVersion(newFile.dataset_version || 1);
    router.push(`/dashboard?fileId=${newFile.id}`);
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {!fileId || !file ? (
          /* Upload View */
          <ParticleDrift className="flex-1" particleCount={100}>
            <div className="flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-xl text-center mb-8">
                <img
                  src="jheains.jpg"
                  alt="XELENS Logo"
                  className="mx-auto mb-4 h-20 w-auto object-contain"
                />
                <h1 className="text-2xl font-bold text-white mb-2">AI Excel Analyzer</h1>
                <p className="text-sm text-gray-400">
                  Upload an Excel file and let AI analyze your data
                </p>
              </div>
              <FileUpload onUpload={handleUpload} />
              {recentFiles.length > 0 && (
                <div className="w-full max-w-xl mt-8">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Recent Files</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {recentFiles.map((rf) => (
                      <button
                        key={rf.id}
                        onClick={() => router.push(`/dashboard?fileId=${rf.id}`)}
                        className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{rf.original_filename}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ParticleDrift>
        ) : (
          /* File View */
          <>
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4 text-green-400" />
                <div>
                  <h2 className="text-sm font-medium text-white">
                    {file.original_filename}
                    {hasUnsavedChanges ? (
                      <span className="ml-2 text-yellow-400 text-xs">Unsaved</span>
                    ) : (
                      <span className="ml-2 text-green-400 text-xs">Saved</span>
                    )}
                    <span className="ml-2 text-gray-500 text-xs">v{datasetVersion}</span>
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {saveMessage && (
                  <span className="text-xs text-green-400">{saveMessage}</span>
                )}
                {hasUnsavedChanges && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/30">
                <div className="flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Content - Two Column Layout */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                {/* Left: Spreadsheet Editor */}
                <div className="flex-1 min-w-0 border-r border-gray-800">
                  <ExcelEditor
                    fileId={file.id}
                    sheets={file.sheets}
                    onSheetChange={() => {}}
                    onUnsavedChange={handleUnsavedChange}
                    onDataChanged={handleDataChanged}
                  />
                </div>

                {/* Right: AI Analysis Panel */}
                <div className="w-96 flex flex-col overflow-hidden bg-gray-900/50">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <AISummary
                      fileId={file.id}
                      columns={currentColumns}
                      rows={currentRows}
                      datasetVersion={datasetVersion}
                    />
                    <RelevantCharts
                      fileId={file.id}
                      columns={currentColumns}
                      rows={currentRows}
                    />
                    <KeyInsights
                      fileId={file.id}
                      columns={currentColumns}
                      rows={currentRows}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-950">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
