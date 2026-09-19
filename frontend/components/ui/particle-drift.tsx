"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  opacity: number;
  size: number;
}

interface ParticleDriftProps {
  className?: string;
  children?: React.ReactNode;
  particleCount?: number;
  colors?: string[];
}

const ASCII_CHARS = "01".split("");

function createParticle(
  width: number,
  height: number,
  colors: string[]
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.15 + Math.random() * 0.35;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    char: ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)],
    opacity: 0.1 + Math.random() * 0.4,
    size: 10 + Math.random() * 4,
  };
}

export default function ParticleDrift({
  className,
  children,
  particleCount = 120,
  colors = ["#22d3ee", "#a78bfa", "#34d399", "#f472b6"],
}: ParticleDriftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const particleColor = useMemo(
    () => colors[Math.floor(Math.random() * colors.length)],
    [colors]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    const rect = canvas.getBoundingClientRect();
    particlesRef.current = Array.from({ length: particleCount }, () =>
      createParticle(rect.width, rect.height, colors)
    );

    function draw() {
      const w = canvas!.getBoundingClientRect().width;
      const h = canvas!.getBoundingClientRect().height;
      ctx!.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) { p.x = w; p.y = Math.random() * h; }
        if (p.x > w) { p.x = 0; p.y = Math.random() * h; }
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        if (p.y > h) { p.y = 0; p.x = Math.random() * w; }

        ctx!.font = `${p.size}px monospace`;
        ctx!.fillStyle = particleColor;
        ctx!.globalAlpha = p.opacity;
        ctx!.fillText(p.char, p.x, p.y);
      }

      ctx!.globalAlpha = 1;

      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const a = particlesRef.current[i];
          const b = particlesRef.current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = particleColor;
            ctx!.globalAlpha = (1 - dist / 120) * 0.15;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      ctx!.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [particleCount, particleColor, colors]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
