"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Database,
  Brain,
  Activity,
  FileText,
  HeartPulse,
  Shield,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { authAPI } from "@/lib/api";
import { User } from "@/types";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/datasets", label: "Datasets", icon: Database },
  { href: "/admin/analyses", label: "Analyses", icon: FileText },
  { href: "/admin/usage", label: "AI Usage", icon: Brain },
  { href: "/admin/logs", label: "Logs", icon: Activity },
  { href: "/admin/health", label: "System Health", icon: HeartPulse },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/auth");
          return;
        }
        const res = await authAPI.me();
        if (res.data.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setUser(res.data);
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/auth");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-gray-400">Loading admin panel...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside
        className={`bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-white">Admin Panel</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Back to App</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
