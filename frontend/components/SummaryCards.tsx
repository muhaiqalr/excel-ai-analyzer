"use client";

import {
  Rows3,
  Columns3,
  Grid3X3,
  AlertTriangle,
  Hash,
  Type,
  Calendar,
  BarChart3,
  ToggleLeft,
} from "lucide-react";
import { DatasetOverview } from "@/types";

interface Props {
  overview: DatasetOverview | null;
  loading: boolean;
}

function Card({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-[11px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex items-center gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-gray-700" />
      <div>
        <div className="h-5 w-12 bg-gray-700 rounded mb-1" />
        <div className="h-3 w-16 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export default function SummaryCards({ overview, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-center">
            <p className="text-xs text-gray-500">--</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card
        icon={<Rows3 className="w-4 h-4 text-blue-400" />}
        label="Total Rows"
        value={overview.total_rows}
        color="bg-blue-900/30"
      />
      <Card
        icon={<Columns3 className="w-4 h-4 text-purple-400" />}
        label="Total Columns"
        value={overview.total_columns}
        color="bg-purple-900/30"
      />
      <Card
        icon={<Grid3X3 className="w-4 h-4 text-cyan-400" />}
        label="Total Cells"
        value={overview.total_cells}
        color="bg-cyan-900/30"
      />
      <Card
        icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
        label="Missing Values"
        value={overview.missing_cells}
        color="bg-amber-900/30"
      />
      <Card
        icon={<Hash className="w-4 h-4 text-green-400" />}
        label="Numeric Columns"
        value={overview.numeric_columns}
        color="bg-green-900/30"
      />
      <Card
        icon={<BarChart3 className="w-4 h-4 text-pink-400" />}
        label="Categorical Columns"
        value={overview.categorical_columns + overview.text_columns}
        color="bg-pink-900/30"
      />
    </div>
  );
}
