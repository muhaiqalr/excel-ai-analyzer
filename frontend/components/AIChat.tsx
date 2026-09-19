"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, User, Bot, Trash2 } from "lucide-react";
import { analysisAPI } from "@/lib/api";
import { AnalysisSession, AnalysisMessage } from "@/types";

interface Props {
  sessionId: string;
}

export default function AIChat({ sessionId }: Props) {
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSession() {
    try {
      const res = await analysisAPI.getSession(sessionId);
      setSession(res.data.session);
      setMessages(res.data.messages);
    } catch {
      setSession({ id: sessionId, file_id: '', title: 'AI Analysis', created_at: '', updated_at: '', message_count: 0 });
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: AnalysisMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content: text,
      metadata_json: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await analysisAPI.sendMessage(sessionId, text);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
        return [...withoutTemp, res.data];
      });
    } catch {
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
        return [
          ...withoutTemp,
          {
            id: `error-${Date.now()}`,
            session_id: sessionId,
            role: "assistant",
            content:
              "Sorry, I encountered an error processing your request. Please try again.",
            metadata_json: null,
            created_at: new Date().toISOString(),
          },
        ];
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">
            {session?.title || "AI Analysis"}
          </h3>
          <p className="text-xs text-gray-400">Powered by Gemini AI</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              Ask me anything about your data!
            </p>
            <div className="mt-4 space-y-2 text-xs text-gray-600">
              <p>&quot;What are the main trends in this data?&quot;</p>
              <p>&quot;Show me summary statistics for column X&quot;</p>
              <p>&quot;Are there any outliers?&quot;</p>
              <p>&quot;Compare columns A and B&quot;</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="text-xs opacity-50 mt-1">
                {new Date(msg.created_at).toLocaleTimeString()}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            rows={1}
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
