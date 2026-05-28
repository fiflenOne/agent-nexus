import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";

const MIN_W = 260;
const MIN_H = 180;
const MAX_W = 720;
const MAX_H = 520;
const STORAGE_KEY = "monad.floating.size";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getViewportMax() {
  if (typeof window === "undefined") return { w: MAX_W, h: MAX_H };
  return {
    w: Math.min(MAX_W, window.innerWidth - 32),
    h: Math.min(MAX_H, window.innerHeight - 32),
  };
}

export default function FloatingResizableWindow({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === "undefined") return { w: 340, h: 240 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { w: number; h: number };
        const vp = getViewportMax();
        return {
          w: clamp(parsed.w, MIN_W, vp.w),
          h: clamp(parsed.h, MIN_H, vp.h),
        };
      }
    } catch {
      /* ignore */
    }
    return { w: 340, h: 240 };
  });

  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Re-clamp on viewport resize so window never escapes.
  useEffect(() => {
    const onWinResize = () => {
      const vp = getViewportMax();
      setSize((s) => ({
        w: clamp(s.w, MIN_W, vp.w),
        h: clamp(s.h, MIN_H, vp.h),
      }));
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  const persist = useCallback((w: number, h: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ w, h }));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
    };
    setIsResizing(true);
  }, [size.w, size.h]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const vp = getViewportMax();
    // Anchored bottom-right: drag left/up to grow.
    const nextW = clamp(d.startW + (d.startX - e.clientX), MIN_W, vp.w);
    const nextH = clamp(d.startH + (d.startY - e.clientY), MIN_H, vp.h);
    setSize({ w: nextW, h: nextH });
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
    setIsResizing(false);
    persist(size.w, size.h);
  }, [size.w, size.h, persist]);

  return (
    <div
      className="absolute bottom-4 right-4 rounded-xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl shadow-cyan-500/10 overflow-hidden"
      style={{
        width: size.w,
        height: size.h,
        userSelect: isResizing ? "none" : undefined,
      }}
    >
      {children}

      {/* Resize handle — top-left corner (window anchored bottom-right) */}
      <div
        role="separator"
        aria-label="Resize visualizer window"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="absolute top-0 left-0 w-5 h-5 cursor-nwse-resize z-20 group"
        style={{ touchAction: "none" }}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-full h-full text-cyan-300/50 group-hover:text-cyan-300/90 transition-colors"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="13" y1="3" x2="3" y2="13" />
          <line x1="9" y1="3" x2="3" y2="9" />
          <line x1="13" y1="7" x2="7" y2="13" />
        </svg>
      </div>
    </div>
  );
}
