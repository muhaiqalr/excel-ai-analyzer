import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/api/auth/login", data),
  me: () => api.get("/api/auth/me"),
};

// Files
export const filesAPI = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/api/files/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  list: () => api.get("/api/files"),
  get: (id: string) => api.get(`/api/files/${id}`),
  data: (id: string, sheet: string, page = 1, pageSize = 100) =>
    api.get(`/api/files/${id}/data`, { params: { sheet_name: sheet, page, page_size: pageSize } }),
  stats: (id: string, sheet: string) =>
    api.get(`/api/files/${id}/statistics`, { params: { sheet_name: sheet } }),
  charts: (id: string, sheet: string) =>
    api.get(`/api/files/${id}/charts`, { params: { sheet_name: sheet } }),
  updateData: (id: string, data: {
    changes?: { sheet_name: string; row: number; column: string; value: unknown }[];
    structural?: { operation: string; sheet_name: string; index?: number; column_name?: string; new_name?: string; row_data?: unknown[] }[];
  }) =>
    api.put(`/api/files/${id}/data`, data),
  saveData: (id: string, data: {
    changes?: { sheet_name: string; row: number; column: string; value: unknown }[];
    structural?: { operation: string; sheet_name: string; index?: number; column_name?: string; new_name?: string; row_data?: unknown[] }[];
    dataset_version: number;
  }) =>
    api.put(`/api/files/${id}/data/save`, data),
  discard: (id: string) => api.delete(`/api/files/${id}/data/discard`),
  getVersion: (id: string) => api.get(`/api/files/${id}/version`),
  versions: (id: string) => api.get(`/api/files/${id}/versions`),
  renameFile: (id: string, filename: string) =>
    api.put(`/api/files/${id}`, { filename }),
  delete: (id: string) => api.delete(`/api/files/${id}`),
  sheetAnalysis: (id: string, sheetName: string) =>
    api.get(`/api/files/${id}/sheets/${encodeURIComponent(sheetName)}/analysis`),
};

// Analysis
export const analysisAPI = {
  createSession: (fileId: string, title?: string) =>
    api.post(`/api/analysis/${fileId}/sessions`, { file_id: fileId, title }),
  listSessions: () => api.get("/api/analysis/sessions"),
  getSession: (sessionId: string) => api.get(`/api/analysis/sessions/${sessionId}`),
  sendMessage: (sessionId: string, content: string) =>
    api.post(`/api/analysis/sessions/${sessionId}/messages`, { content }),
  deleteSession: (sessionId: string) =>
    api.delete(`/api/analysis/sessions/${sessionId}`),
  calculateStatistics: (columns: string[], rows: unknown[][]) =>
    api.post("/api/analysis/statistics", { columns, rows }),
  calculateCharts: (
    columns: string[],
    rows: unknown[][],
    opts?: { chart_type?: string; x_column?: string; y_column?: string; aggregation?: string }
  ) =>
    api.post("/api/analysis/charts", { columns, rows, ...opts }),
  chat: (fileId: string, content: string, sheetName?: string, columns?: string[], rows?: unknown[][], datasetVersion?: number) =>
    api.post(`/api/analysis/${fileId}/chat`, { content, sheet_name: sheetName, columns, rows, dataset_version: datasetVersion }),
  autoAnalyze: (fileId: string) =>
    api.post(`/api/analysis/${fileId}/analyze`),
};

// History
export const historyAPI = {
  create: (data: {
    file_id: string;
    filename: string;
    dataset_version?: number;
    analysis_question: string;
    ai_response: string;
    statistics_snapshot?: Record<string, unknown>;
    chart_config?: Record<string, unknown>;
    dataset_snapshot?: Record<string, unknown>;
  }) => api.post("/api/history", data),
  list: () => api.get("/api/history"),
  get: (historyId: string) => api.get(`/api/history/${historyId}`),
  delete: (historyId: string) => api.delete(`/api/history/${historyId}`),
};

// Admin
export const adminAPI = {
  dashboard: () => api.get("/api/admin/dashboard"),
  listUsers: (page = 1, pageSize = 20, search = "") =>
    api.get("/api/admin/users", { params: { page, page_size: pageSize, search } }),
  getUser: (userId: string) => api.get(`/api/admin/users/${userId}`),
  updateUser: (userId: string, data: { role?: string; is_active?: boolean }) =>
    api.patch(`/api/admin/users/${userId}`, data),
  listDatasets: (page = 1, pageSize = 20, search = "") =>
    api.get("/api/admin/datasets", { params: { page, page_size: pageSize, search } }),
  listAnalyses: (page = 1, pageSize = 20) =>
    api.get("/api/admin/analyses", { params: { page, page_size: pageSize } }),
  listUsage: (page = 1, pageSize = 20) =>
    api.get("/api/admin/usage", { params: { page, page_size: pageSize } }),
  listLogs: (page = 1, pageSize = 20, eventType = "") =>
    api.get("/api/admin/logs", { params: { page, page_size: pageSize, event_type: eventType } }),
  health: () => api.get("/api/admin/health"),
};

// Advanced Analysis
export const advancedAPI = {
  profile: (fileId: string) => api.post(`/api/analysis/${fileId}/profile`),
  insights: (fileId: string) => api.post(`/api/analysis/${fileId}/insights`),
  trends: (fileId: string, dateColumn?: string, valueColumn?: string) =>
    api.post(`/api/analysis/${fileId}/trends`, { date_column: dateColumn, value_column: valueColumn }),
  compare: (fileId: string, groupColumn: string, valueColumn: string) =>
    api.post(`/api/analysis/${fileId}/compare`, { group_column: groupColumn, value_column: valueColumn }),
  topBottom: (fileId: string, column: string, n: number = 5, ascending: boolean = false) =>
    api.post(`/api/analysis/${fileId}/top-bottom`, { column, n, ascending }),
  anomalies: (fileId: string, column?: string) =>
    api.post(`/api/analysis/${fileId}/anomalies`, { column }),
  forecast: (fileId: string, dateColumn: string, valueColumn: string, periods: number = 3) =>
    api.post(`/api/analysis/${fileId}/forecast`, { date_column: dateColumn, value_column: valueColumn, periods }),
  chartRecommend: (fileId: string) => api.post(`/api/analysis/${fileId}/chart-recommend`),
  report: (fileId: string) => api.post(`/api/analysis/${fileId}/report`),
  explain: (fileId: string, analysisType: string, params: Record<string, unknown> = {}) =>
    api.post(`/api/analysis/${fileId}/explain`, { analysis_type: analysisType, params }),
  ask: (fileId: string, question: string) =>
    api.post(`/api/analysis/${fileId}/ask`, { question }),
};

export default api;
