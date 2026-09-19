"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Database,
  Brain,
  HardDrive,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { adminAPI } from "@/lib/api";
import { AdminDashboard } from "@/types";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok" || status === "connected" || status === "configured" || status === "available") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400">
        <CheckCircle className="w-3 h-3" /> {status}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/50 text-red-400">
        <XCircle className="w-3 h-3" /> {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-900/50 text-yellow-400">
      <AlertTriangle className="w-3 h-3" /> {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminAPI.dashboard();
        setData(res.data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-red-400 py-12">Failed to load dashboard data</div>
    );
  }

  const cards = [
    { label: "Total Users", value: data.total_users, icon: Users, color: "blue" },
    { label: "Active Users", value: data.active_users, icon: Users, color: "green" },
    { label: "Total Datasets", value: data.total_datasets, icon: Database, color: "purple" },
    { label: "Total Analyses", value: data.total_analyses, icon: Activity, color: "cyan" },
    { label: "AI Requests", value: data.ai_requests, icon: Brain, color: "yellow" },
    { label: "Storage Used", value: formatBytes(data.storage_bytes), icon: HardDrive, color: "orange" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
              </div>
              <card.icon className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        ))}
      </div>

      {/* System Status */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">Backend</span>
            <StatusBadge status={data.system_status} />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">Database</span>
            <StatusBadge status={data.db_status} />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">AI Provider</span>
            <StatusBadge status={data.ai_configured ? "configured" : "not_configured"} />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">Storage</span>
            <StatusBadge status="available" />
          </div>
        </div>
      </div>
    </div>
  );
}
