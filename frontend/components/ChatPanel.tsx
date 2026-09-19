"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Trash2,
  Sparkles,
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { analysisAPI } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart_request?: Record<string, unknown> | null;
  timestamp: Date;
}

interface Props {
  fileId: string;
  fileName: string;
  sheetName: string;
  onChartRequest?: (config: Record<string, unknown>) => void;
  liveColumns?: string[];
  liveRows?: unknown[][];
  datasetVersion?: number;
  onReanalyze?: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Give me a summary of this dataset",
  "What are the highest and lowest values?",
  "Are there any outliers?",
  "What columns have missing data?",
  "Show me the correlation between numeric columns",
  "What are the main trends?",
  "Create a bar chart of the data",
  "Compare the top categories",
];

export default function ChatPanel({
  fileId,
  fileName,
  sheetName,
  onChartRequest,
  liveColumns,
  liveRows,
  datasetVersion,
  onReanalyze,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(datasetVersion || 1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (datasetVersion) setDataVersion(datasetVersion);
  }, [datasetVersion]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const res = await analysisAPI.chat(
          fileId,
          content.trim(),
          sheetName,
          liveColumns && liveColumns.length > 0 ? liveColumns : undefined,
          liveRows && liveRows.length > 0 ? liveRows : undefined,
          dataVersion
        );
        const data = res.data;

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.content,
          chart_request: data.chart_request || null,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (data.chart_request && onChartRequest) {
          onChartRequest(data.chart_request);
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to get AI response";
        setError(errorMsg);
        const error_msg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "I encountered an error while processing your request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, error_msg]);
      } finally {
        setLoading(false);
      }
    },
    [fileId, sheetName, loading, onChartRequest, liveColumns, liveRows, dataVersion]
  );

  const handleAutoAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);

    const analyzeMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: "Analyze this dataset",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, analyzeMsg]);

    try {
      const res = await analysisAPI.autoAnalyze(fileId);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.data.analysis,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Failed to generate analysis. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [fileId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleSuggestionClick(question: string) {
    sendMessage(question);
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">AI Analyst</h3>
          {liveColumns && liveColumns.length > 0 && (
            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              Live data
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded"
              title="Re-analyze with latest data"
            >
              <RefreshCw className="w-3 h-3" />
              Re-analyze
            </button>
          )}
          <button
            onClick={handleAutoAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded"
          >
            {analyzing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Analyze
          </button>
          <button
            onClick={() => setMessages([])}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* File info bar */}
      <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex items-center gap-2 text-[11px] text-gray-400">
        <FileSpreadsheet className="w-3 h-3 text-green-400" />
        <span className="truncate">{fileName}</span>
        <span className="text-gray-600">|</span>
        <span className="truncate">{sheetName}</span>
        {liveColumns && liveColumns.length > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-green-400">
              {liveColumns.length} cols, {liveRows?.length || 0} rows (live)
            </span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-8 h-8 text-purple-400/50 mb-3" />
            <h4 className="text-sm font-medium text-white mb-1">
              AI Data Analyst
            </h4>
            <p className="text-xs text-gray-500 mb-4 max-w-[250px]">
              Ask questions about your Excel data. I can analyze statistics,
              find trends, detect outliers, and create charts.
            </p>
            {liveColumns && liveColumns.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-green-400 mb-3">
                <RefreshCw className="w-3 h-3" />
                Using current dataset (v{dataVersion})
              </div>
            )}
            <div className="grid grid-cols-1 gap-1.5 w-full max-w-[280px]">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestionClick(q)}
                  className="text-left px-3 py-2 text-[11px] text-gray-300 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-200 border border-gray-700"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-purple-400 font-medium">
                    AI Analyst
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
              {msg.chart_request && (
                <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-600">
                  <div className="flex items-center gap-1 text-[10px] text-blue-300">
                    <BarChart3 className="w-3 h-3" />
                    <span>
                      Chart suggested: {String(msg.chart_request.chart_type)}{" "}
                      of {String(msg.chart_request.y_column)} by{" "}
                      {String(msg.chart_request.x_column)}
                    </span>
                  </div>
                </div>
              )}
              <div className="text-[9px] text-gray-500 mt-1">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                <span className="text-gray-400">Analyzing current data...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800/30 rounded-lg text-[11px] text-red-300">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500 max-h-24"
            style={{ minHeight: "36px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-gray-600 mt-1">
          Enter to send, Shift+Enter for new line
          {liveColumns && liveColumns.length > 0 && (
            <span className="ml-2 text-green-600">
              | Using live dataset (v{dataVersion})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
