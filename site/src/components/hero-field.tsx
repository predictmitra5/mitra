"use client";

import { useEffect, useRef } from "react";

/*
 * The faint moving field of market lines behind the opening (the owner's
 * choice, DECISIONS.md 2026-10-20): thin white lines that wander like price
 * histories and drift slowly left, with one line now and then brightening and
 * a dot pulsing where it is "now". It is decoration with no data behind it.
 * It stops when it is off screen, when the tab is hidden, when the visitor
 * presses pause, and draws a single still frame for people who ask their
 * device to reduce motion.
 */

type Line = { base: number; amp: number; slope: number; speed: number; coarse: number; fine: number; alpha: number; seed: number; pulse: number };

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(20261020);
const TABLE = Float32Array.from({ length: 1024 }, () => random());

/** Smooth 1-D value noise in [0, 1]. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = TABLE[i & 1023];
  const b = TABLE[(i + 1) & 1023];
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

function makeLines(height: number): Line[] {
  const count = Math.max(14, Math.min(26, Math.round(height / 34)));
  const pick = seeded(7 + count);
  return Array.from({ length: count }, (_, index) => {
    const spread = (index + 0.5) / count;
    return {
      base: 0.12 + spread * 0.8 + (pick() - 0.5) * 0.04,
      amp: 16 + pick() * 46,
      slope: (pick() - 0.5) * 0.06,
      speed: 7 + pick() * 15,
      coarse: 240 + pick() * 300,
      fine: 34 + pick() * 40,
      alpha: 0.06 + pick() * 0.09,
      seed: pick() * 900,
      pulse: 0,
    };
  });
}

export function HeroField({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    wakeRef.current();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let lines: Line[] = [];
    let time = 0;
    let last = 0;
    let frame = 0;
    let visible = true;
    let nextPulse = 1.2;
    let pulsing = -1;

    const yAt = (line: Line, x: number) => {
      const shifted = x + time * line.speed;
      const wave = (noise(line.seed + shifted / line.coarse) - 0.5) * 2 * line.amp
        + (noise(line.seed * 2 + shifted / line.fine) - 0.5) * 0.36 * line.amp;
      return line.base * height + wave + line.slope * (x - width / 2);
    };

    const draw = () => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.lineJoin = "round";
      const step = width > 900 ? 6 : 5;
      const head = width * 0.8;
      for (const line of lines) {
        const alpha = Math.min(0.5, line.alpha + line.pulse * 0.32);
        context.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        context.beginPath();
        for (let x = -step; x <= width + step; x += step) {
          const y = yAt(line, x);
          if (x === -step) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
        if (line.pulse > 0.02) {
          const y = yAt(line, head);
          context.fillStyle = `rgba(255,255,255,${Math.min(1, line.pulse * 1.4).toFixed(3)})`;
          context.beginPath();
          context.arc(head, y, 2.6, 0, Math.PI * 2);
          context.fill();
          const ring = (1 - line.pulse) * 16 + 3;
          context.strokeStyle = `rgba(255,255,255,${(line.pulse * 0.5).toFixed(3)})`;
          context.beginPath();
          context.arc(head, y, ring, 0, Math.PI * 2);
          context.stroke();
        }
      }
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      lines = makeLines(height);
      draw();
    };

    const loop = (now: number) => {
      frame = 0;
      const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      time += delta;
      nextPulse -= delta;
      if (nextPulse <= 0 && lines.length) {
        pulsing = Math.floor(random() * lines.length);
        lines[pulsing].pulse = 1;
        nextPulse = 1.4 + random() * 1.6;
      }
      for (const line of lines) line.pulse = Math.max(0, line.pulse - delta * 0.55);
      draw();
      wake();
    };

    const running = () => !still && visible && !pausedRef.current && document.visibilityState === "visible";
    const wake = () => {
      if (running()) {
        if (!frame) frame = requestAnimationFrame(loop);
      } else {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
    };
    wakeRef.current = wake;

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    viewObserver.observe(canvas);
    document.addEventListener("visibilitychange", wake);
    resize();
    wake();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", wake);
      wakeRef.current = () => {};
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-field" data-hero-field aria-hidden="true" />;
}
