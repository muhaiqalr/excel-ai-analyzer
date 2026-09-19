"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  BarChart3,
  MessageSquare,
  Loader2,
  Table2,
  TrendingUp,
  Eye,
  AlertCircle,
  LayoutDashboard,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import FileUpload from "@/components/FileUpload";
import ExcelEditor from "@/components/ExcelEditor";
import StatsPanel from "@/components/StatsPanel";
import Charts from "@/components/Charts";
import DataPreview from "@/components/DataPreview";
import SummaryCards from "@/components/SummaryCards";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import OutlierViz from "@/components/OutlierViz";
import MissingDataChart from "@/components/MissingDataChart";
import InsightsPanel from "@/components/InsightsPanel";
import InteractiveCharts from "@/components/InteractiveCharts";
import ChatPanel from "@/components/ChatPanel";
import AdvancedAnalysis from "@/components/AdvancedAnalysis";
import ParticleDrift from "@/components/ui/particle-drift";
import { filesAPI, analysisAPI, historyAPI } from "@/lib/api";
import { FileItem, FullStatistics, ChartConfig } from "@/types";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileId = searchParams.get("fileId");

  const [file, setFile] = useState<FileItem | null>(null);
  const [stats, setStats] = useState<FullStatistics | null>(null);
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState("");
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "preview" | "editor" | "stats" | "charts" | "chat" | "advanced"
  >("dashboard");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [analysisOutdated, setAnalysisOutdated] = useState(false);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);

  const [currentColumns, setCurrentColumns] = useState<string[]>([]);
  const [currentRows, setCurrentRows] = useState<unknown[][]>([]);
  const [datasetVersion, setDatasetVersion] = useState(1);
  const changeCountRef = useRef(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<{ columns: string[]; rows: unknown[][] } | null>(null);
  const fileRef = useRef<FileItem | null>(null);
  const statsRef = useRef<FullStatistics | null>(null);

  useEffect(() => { fileRef.current = file; }, [file]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  useEffect(() => {
    if (fileId) loadFile(fileId);
    else {
      setFile(null);
      setStats(null);
      setCharts([]);
      setError(null);
      setCurrentColumns([]);
      setCurrentRows([]);
      loadRecentFiles();
    }
  }, [fileId]);

  async function loadRecentFiles() {
    try {
      const res = await filesAPI.list();
      setRecentFiles(res.data.slice(0, 6));
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    if (file && activeSheet && activeTab !== "preview") {
      loadAnalytics(file.id, activeSheet);
    }
  }, [file, activeSheet, activeTab]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  async function loadFile(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await filesAPI.get(id);
      setFile(res.data);
      setDatasetVersion(res.data.dataset_version || 1);
      if (res.data.sheets?.length > 0) {
        setActiveSheet(res.data.sheets[0].sheet_name);
      }
    } catch (err: unknown) {
      const apiErr = err as { code?: string };
      if (apiErr.code === 'ERR_NETWORK') {
        setError("Cannot connect to server. Please ensure the backend is running on port 8000.");
      } else {
        setError("Failed to load file. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics(id: string, sheet: string) {
    try {
      const [statsRes, chartsRes] = await Promise.all([
        filesAPI.stats(id, sheet),
        filesAPI.charts(id, sheet),
      ]);
      setStats(statsRes.data);
      setCharts(chartsRes.data);
    } catch {
      // silently fail
    }
  }

  const calculateInlineStats = useCallback(
    async (columns: string[], rows: unknown[][]) => {
      if (columns.length === 0 || rows.length === 0) {
        setStats(null);
        return;
      }
      setStatsLoading(true);
      try {
        const res = await analysisAPI.calculateStatistics(columns, rows);
        setStats(res.data);
      } catch {
        // silently fail
      } finally {
        setStatsLoading(false);
      }
    },
    []
  );

  const debouncedStats = useCallback(
    (columns: string[], rows: unknown[][]) => {
      pendingDataRef.current = { columns, rows };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          calculateInlineStats(
            pendingDataRef.current.columns,
            pendingDataRef.current.rows
          );
          pendingDataRef.current = null;
        }
      }, 800);
    },
    [calculateInlineStats]
  );

  function handleDataChanged(data?: { columns: string[]; rows: unknown[][] }) {
    if (data && data.columns.length > 0 && data.rows.length > 0) {
      setCurrentColumns(data.columns);
      setCurrentRows(data.rows);
      changeCountRef.current += 1;
      debouncedStats(data.columns, data.rows);
      setAnalysisOutdated(true);
    } else if (file && activeSheet) {
      loadAnalytics(file.id, activeSheet);
    }
  }

  function handleUnsavedChange(hasUnsaved: boolean) {
    setHasUnsavedChanges(hasUnsaved);
    if (!hasUnsaved) {
      changeCountRef.current = 0;
    }
  }

  function handleSheetSelect(sheetName: string) {
    setActiveSheet(sheetName);
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const origRes = await filesAPI.data(file.id, activeSheet, 1, 10000);
      const origData = origRes.data;
      const origColumns: string[] = origRes.data.columns;

      const changes: {
        sheet_name: string;
        row: number;
        column: string;
        value: unknown;
      }[] = [];
      const structural: {
        operation: string;
        sheet_name: string;
        index?: number;
        column_name?: string;
      }[] = [];

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
            changes.push({
              sheet_name: activeSheet,
              row: r,
              column: currentColumns[c],
              value: newVal,
            });
          }
        }
      }

      if (currentColumns.length > origColumns.length) {
        for (let c = origColumns.length; c < currentColumns.length; c++) {
          structural.push({
            operation: "add_column",
            sheet_name: activeSheet,
            index: c,
            column_name: currentColumns[c],
          });
        }
      }
      const removedCols = origColumns.filter((c) => !currentColumns.includes(c));
      for (const col of removedCols) {
        structural.push({
          operation: "delete_column",
          sheet_name: activeSheet,
          column_name: col,
        });
      }
      if (currentRows.length > origData.rows.length) {
        for (let r = origData.rows.length; r < currentRows.length; r++) {
          structural.push({ operation: "add_row", sheet_name: activeSheet, index: r });
          for (let c = 0; c < currentColumns.length; c++) {
            const val = currentRows[r]?.[c];
            if (val !== null && val !== undefined && val !== "") {
              changes.push({
                sheet_name: activeSheet,
                row: r,
                column: currentColumns[c],
                value: val,
              });
            }
          }
        }
      } else if (currentRows.length < origData.rows.length) {
        for (let r = origData.rows.length - 1; r >= currentRows.length; r--) {
          structural.push({ operation: "delete_row", sheet_name: activeSheet, index: r });
        }
      }

      if (changes.length > 0 || structural.length > 0) {
        const saveRes = await filesAPI.saveData(file.id, {
          changes,
          structural,
          dataset_version: datasetVersion,
        });
        setDatasetVersion(saveRes.data.dataset_version);
        setFile((prev) => prev ? { ...prev, dataset_version: saveRes.data.dataset_version } : prev);
        setSaveMessage(saveRes.data.message);
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage("No changes to save.");
        setTimeout(() => setSaveMessage(null), 3000);
      }

      setHasUnsavedChanges(false);
      changeCountRef.current = 0;
      setAnalysisOutdated(false);
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (apiErr.response?.status === 409) {
      setError(apiErr.response?.data?.detail || "Version conflict. Reloading file...");
        await loadFile(file.id);
        if (fileRef.current?.sheets?.length && fileRef.current.sheets.length > 0) {
          setActiveSheet(fileRef.current.sheets[0].sheet_name);
        }
      } else {
        setError("Failed to save changes. Your edits are preserved — please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    if (!file) return;
    if (!confirm("Discard all unsaved changes? This cannot be undone.")) return;
    setSaving(true);
    try {
      await filesAPI.discard(file.id);
      await loadFile(file.id);
      setHasUnsavedChanges(false);
      changeCountRef.current = 0;
      setSaveMessage("Changes discarded.");
      setAnalysisOutdated(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setError("Failed to discard changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleRefreshAnalysis() {
    if (currentColumns.length > 0 && currentRows.length > 0) {
      debouncedStats(currentColumns, currentRows);
    } else if (file && activeSheet) {
      loadAnalytics(file.id, activeSheet);
    }
    setAnalysisOutdated(false);
  }

  function handleUpload(newFile: FileItem) {
    setFile(newFile);
    setDatasetVersion(newFile.dataset_version || 1);
    setActiveTab("dashboard");
    if (newFile.sheets?.length > 0) {
      setActiveSheet(newFile.sheets[0].sheet_name);
    }
    router.push(`/dashboard?fileId=${newFile.id}`);
  }

  async function handleReanalyze() {
    const latestFile = fileRef.current;
    if (!latestFile) return;
    setAnalysisOutdated(false);
    try {
      const res = await analysisAPI.autoAnalyze(latestFile.id);
      await historyAPI.create({
        file_id: latestFile.id,
        filename: latestFile.original_filename,
        dataset_version: datasetVersion,
        analysis_question: "Re-analysis of updated dataset",
        ai_response: res.data.analysis,
        statistics_snapshot: statsRef.current ? { full_statistics: statsRef.current } : undefined,
        dataset_snapshot: {
          columns: currentColumns,
          row_count: currentRows.length,
        },
      });
      setSaveMessage("Re-analysis completed and saved to history.");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setError("Re-analysis failed. Please try again.");
    }
  }

  function handleChatChartRequest(config: Record<string, unknown>) {
    setActiveTab("charts");
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {!fileId || !file ? (
          /* Upload View */
          <ParticleDrift className="flex-1" particleCount={100}>
            <div className="flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-2xl">
              <div className="text-center mb-6 sm:mb-8">
                <img
                  src="jheains.jpg"
                  alt="SISTEM XELENS JHEAINS Logo"
                  className="mx-auto mb-4 h-20 sm:h-28 w-auto object-contain"
                />
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  SISTEM XELENS JHEAINS
                </h1>
                <p className="text-sm sm:text-base text-gray-400">
                  Muat naik fail Excel atau CSV untuk mula menganalisis data
                  dengan kecerdasan buatan
                </p>
              </div>
              <FileUpload onUpload={handleUpload} />

              <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 sm:mt-8 mb-6 sm:mb-8">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 sm:p-4 text-center">
                  <Table2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-400">Spreadsheet Editor</p>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 sm:p-4 text-center">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-400">Auto Statistics</p>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 sm:p-4 text-center">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-400">AI Analysis</p>
                </div>
              </div>

              {recentFiles.length > 0 && (
                <div className="w-full mt-4">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-2 sm:mb-3">Recent Datasets</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {recentFiles.map((rf) => (
                      <button
                        key={rf.id}
                        onClick={() => router.push(`/dashboard?fileId=${rf.id}`)}
                        className="flex items-center gap-2 p-2 sm:p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs font-medium text-white truncate">{rf.original_filename}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-500">{rf.total_rows} rows x {rf.total_columns} cols</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </ParticleDrift>
        ) : (
          /* File View */
          <>
            {/* Top Bar */}
            <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                <div>
                  <h2 className="text-sm font-medium text-white">
                    {file.original_filename}
                    {hasUnsavedChanges ? (
                      <span className="ml-2 text-yellow-400 text-xs">
                        ● Unsaved
                      </span>
                    ) : (
                      <span className="ml-2 text-green-400 text-xs">
                        ● Saved
                      </span>
                    )}
                    <span className="ml-2 text-gray-500 text-[10px]">
                      v{datasetVersion}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    {file.total_rows} rows x {file.total_columns} cols |{" "}
                    {file.sheets.length} sheet(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Save/Discard Buttons */}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1 mr-1 sm:mr-2">
                    <button
                      onClick={handleDiscard}
                      disabled={saving}
                      className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded"
                    >
                      <X className="w-3 h-3" />
                      <span className="hidden sm:inline">Discard</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Save
                    </button>
                  </div>
                )}

                {/* Save message */}
                {saveMessage && (
                  <span className="text-[10px] sm:text-xs text-green-400 mr-1 sm:mr-2 truncate max-w-[150px] sm:max-w-none">{saveMessage}</span>
                )}

                <div className="flex bg-gray-800 rounded-lg p-0.5 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "dashboard"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <LayoutDashboard className="w-3 h-3" />
                    <span className="hidden sm:inline">Dashboard</span>
                    <span className="sm:hidden">Home</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "preview"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span className="hidden sm:inline">Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("editor")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "editor"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Table2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Editor</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("stats")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "stats"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span className="hidden sm:inline">Statistics</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("charts")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "charts"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <BarChart3 className="w-3 h-3" />
                    <span className="hidden sm:inline">Charts</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "chat"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span className="hidden sm:inline">AI Chat</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("advanced")}
                    className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap ${
                      activeTab === "advanced"
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span className="hidden sm:inline">Advanced</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Analysis outdated banner */}
            {analysisOutdated && activeTab !== "editor" && (
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-yellow-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Dataset changed. Refresh analysis.</span>
                </div>
                <button
                  onClick={handleRefreshAnalysis}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-[11px] bg-yellow-600 hover:bg-yellow-700 text-white rounded shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3 p-6 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <p className="text-sm text-red-300 text-center">{error}</p>
                    <button
                      onClick={() => { setError(null); if (file) loadFile(file.id); }}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      Dismiss & Reload
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === "dashboard" && (
                    <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                      <SummaryCards overview={stats?.overview || null} loading={statsLoading} />

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        <InsightsPanel
                          insights={stats?.insights || []}
                          loading={statsLoading}
                        />
                        <MissingDataChart
                          columns={stats?.columns || null}
                          loading={statsLoading}
                        />
                      </div>

                      <InteractiveCharts
                        columns={currentColumns}
                        rows={currentRows}
                        colTypes={stats?.columns ? Object.fromEntries(
                          Object.entries(stats.columns).map(([k, v]) => [k, v.type])
                        ) : {}}
                        loading={statsLoading}
                      />

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        <CorrelationHeatmap
                          correlation={stats?.correlation || null}
                          loading={statsLoading}
                        />
                        <OutlierViz
                          outliers={stats?.outliers || null}
                          loading={statsLoading}
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "preview" && (
                    <DataPreview
                      fileId={file.id}
                      sheets={file.sheets}
                      activeSheet={activeSheet}
                      onSheetSelect={handleSheetSelect}
                    />
                  )}

                  {activeTab === "editor" && (
                    <ExcelEditor
                      fileId={file.id}
                      sheets={file.sheets}
                      onSheetChange={setActiveSheet}
                      onUnsavedChange={handleUnsavedChange}
                      onDataChanged={handleDataChanged}
                    />
                  )}

                  {activeTab === "stats" && (
                    <div className="h-full overflow-y-auto">
                      <StatsPanel stats={stats} loading={statsLoading} />
                    </div>
                  )}

                  {activeTab === "charts" && (
                    <div className="h-full overflow-y-auto">
                      <Charts charts={charts} loading={false} />
                    </div>
                  )}

                  {activeTab === "chat" && (
                    <div className="h-full">
                      <ChatPanel
                        fileId={file.id}
                        fileName={file.original_filename}
                        sheetName={activeSheet}
                        onChartRequest={handleChatChartRequest}
                        liveColumns={currentColumns}
                        liveRows={currentRows}
                        datasetVersion={datasetVersion}
                        onReanalyze={handleReanalyze}
                      />
                    </div>
                  )}

                  {activeTab === "advanced" && (
                    <div className="h-full overflow-y-auto p-4">
                      <AdvancedAnalysis
                        fileId={file.id}
                        sheets={file.sheets}
                        onChartRequest={handleChatChartRequest}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
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




