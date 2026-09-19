"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export function FloatingPathsBackground({
  position,
  children,
  className,
}: {
  position: number;
  className?: string;
  children: React.ReactNode;
}) {
  const paths = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 8 * position} -${189 + i * 10}C-${
          380 - i * 8 * position
        } -${189 + i * 10} -${312 - i * 8 * position} ${216 - i * 10} ${
          152 - i * 8 * position
        } ${343 - i * 10}C${616 - i * 8 * position} ${470 - i * 10} ${
          684 - i * 8 * position
        } ${875 - i * 10} ${684 - i * 8 * position} ${875 - i * 10}`,
        width: 0.5 + i * 0.05,
        opacity: 0.05 + i * 0.04,
        duration: 25 + i * 2,
      })),
    [position]
  );

  return (
    <div className={cn("w-full h-full relative overflow-hidden", className)}>
      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="w-full h-full text-slate-950 dark:text-white"
          viewBox="0 0 696 316"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={path.opacity}
              strokeDasharray="200 400"
              style={{
                animation: `floatPath ${path.duration}s linear infinite`,
              }}
            />
          ))}
        </svg>
      </div>
      <style>{`
        @keyframes floatPath {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -1200; }
        }
      `}</style>
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
