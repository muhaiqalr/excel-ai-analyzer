export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Sheet {
  id: string;
  sheet_name: string;
  sheet_index: number;
  row_count: number;
  column_count: number;
  column_names: string[];
  column_types: Record<string, string>;
}

export interface FileItem {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string | null;
  total_sheets: number;
  total_rows: number;
  total_columns: number;
  dataset_version: number;
  created_at: string;
  updated_at: string;
  sheets: Sheet[];
}

export interface FileVersion {
  id: string;
  version_number: number;
  file_size: number;
  change_description: string | null;
  created_at: string;
}

export interface PaginatedData {
  sheet_name: string;
  columns: string[];
  rows: unknown[][];
  total_rows: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ColumnStatistics {
  type: string;
  count: number;
  missing_count: number;
  missing_pct: number;
  non_null_count: number;
  // numeric
  sum?: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
  variance?: number;
  range?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  iqr?: number;
  skewness?: number;
  kurtosis?: number;
  // boolean
  true_count?: number;
  false_count?: number;
  true_pct?: number;
  // categorical
  unique_count?: number;
  most_common?: string;
  most_common_count?: number;
  frequency_distribution?: Record<string, number>;
  percentages?: Record<string, number>;
  // date
  earliest?: string;
  latest?: string;
  range_days?: number;
  by_month?: Record<string, number>;
  by_year?: Record<string, number>;
}

export interface Statistics {
  total_rows: number;
  total_columns: number;
  missing_values_total: number;
  columns: Record<string, ColumnStatistics>;
}

export interface ChartConfig {
  id: string;
  sheet_name: string;
  chart_type: string;
  title: string | null;
  x_column: string | null;
  y_column: string | null;
  config: {
    data: unknown[];
    chart_type: string;
    title: string;
    x_column: string | null;
    y_column: string | null;
  };
  created_at: string;
}

export interface AnalysisSession {
  id: string;
  file_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AnalysisMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ColumnDetail {
  name: string;
  detected_type: string;
  total_count: number;
  non_null_count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
}

export interface SheetAnalysis {
  filename: string;
  sheet_name: string;
  row_count: number;
  column_count: number;
  column_names: string[];
  detected_types: Record<string, string>;
  missing_values: Record<string, { count: number; percentage: number }>;
  column_details: ColumnDetail[];
  preview: Record<string, unknown>[];
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: "left" | "center" | "right";
  numberFormat?: string;
  decimalPlaces?: number;
}

export interface CellStyle {
  [cellKey: string]: CellFormat;
}

export interface DatasetOverview {
  total_rows: number;
  total_columns: number;
  total_cells: number;
  missing_cells: number;
  missing_percentage: number;
  numeric_columns: number;
  text_columns: number;
  date_columns: number;
  categorical_columns: number;
  boolean_columns: number;
}

export interface CorrelationResult {
  matrix: Record<string, Record<string, number>>;
  numeric_columns: string[];
  strong_correlations: {
    column1: string;
    column2: string;
    correlation: number;
    strength: string;
  }[];
}

export interface OutlierResult {
  q1: number;
  q3: number;
  iqr: number;
  lower_bound: number;
  upper_bound: number;
  outlier_count: number;
  total_count: number;
  outlier_percentage: number;
}

export interface InsightItem {
  type: "info" | "warning" | "correlation" | "outlier";
  title: string;
  message: string;
  note?: string;
}

export interface FullStatistics {
  overview: DatasetOverview;
  columns: Record<string, ColumnStatistics>;
  correlation: CorrelationResult;
  outliers: Record<string, OutlierResult>;
  insights: InsightItem[];
}

export interface ChartResult {
  chart_type: string;
  title: string;
  x_column: string | null;
  y_column: string | null;
  data: Record<string, unknown>[];
  aggregation?: string;
  inner_radius?: number;
}

export interface InlineChartsResponse {
  suggestions: ChartResult[];
  columns: Record<string, string>;
}

export interface SaveDataResponse {
  success: boolean;
  dataset_version: number;
  message: string;
}

export interface DiscardResponse {
  success: boolean;
  dataset_version: number;
  message: string;
}

export interface VersionConflictResponse {
  conflict: boolean;
  server_version: number;
  message: string;
}

export interface ChangeTracker {
  modified: boolean;
  dataset_version: number;
  changes_count: number;
  last_modified_at: number | null;
}

export interface DatasetState {
  columns: string[];
  rows: unknown[][];
  dataset_version: number;
  changeCount: number;
  lastModified: number | null;
}

export interface HistoryItem {
  id: string;
  file_id: string;
  filename: string;
  dataset_version: number | null;
  analysis_question: string;
  ai_response: string;
  statistics_snapshot: Record<string, unknown> | null;
  chart_config: Record<string, unknown> | null;
  dataset_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface HistoryListItem {
  id: string;
  file_id: string;
  filename: string;
  dataset_version: number | null;
  analysis_question: string;
  ai_response_preview: string;
  created_at: string;
}

// Admin Types
export interface AdminDashboard {
  total_users: number;
  active_users: number;
  total_datasets: number;
  total_analyses: number;
  ai_requests: number;
  storage_bytes: number;
  system_status: string;
  db_status: string;
  ai_configured: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  dataset_count: number;
  analysis_count: number;
}

export interface AdminDataset {
  id: string;
  filename: string;
  original_filename: string;
  owner_username: string;
  file_size: number;
  total_sheets: number;
  total_rows: number;
  dataset_version: number;
  analysis_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAnalysis {
  id: string;
  username: string;
  filename: string;
  analysis_type: string;
  created_at: string;
}

export interface AdminAIUsage {
  id: string;
  username: string | null;
  model: string | null;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AdminSystemLog {
  id: string;
  event_type: string;
  username: string | null;
  status: string;
  message: string;
  created_at: string;
}

export interface AdminHealth {
  backend: string;
  database: string;
  ai_provider: string;
  storage: string;
}
