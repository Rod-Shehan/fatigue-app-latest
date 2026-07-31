"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { BEST_EFFORT_OPTIONS, getCurrentPosition } from "@/lib/geo";
import {
  buildSignatureCapture,
  type ChecklistSignatureCapture,
} from "@/lib/checklist";

const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 180;
const INK = "#0A1118";

function resetSurface(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export function ChecklistSignaturePanel({
  title = "Signature",
  roleLabel,
  onConfirmed,
  className,
}: {
  title?: string;
  /** e.g. "As driver" / "As loader" */
  roleLabel?: string;
  onConfirmed: (capture: ChecklistSignatureCapture) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<ChecklistSignatureCapture | null>(null);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resetSurface(canvas);
    setHasStroke(false);
    setConfirmed(null);
    drawing.current = false;
    last.current = null;
  }, []);

  useEffect(() => {
    clear();
  }, [clear]);

  const pos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || confirmed) return;
    canvas.setPointerCapture(e.pointerId);
    last.current = pos(e.clientX, e.clientY, canvas);
    drawing.current = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current || confirmed) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = pos(e.clientX, e.clientY, canvas);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasStroke(true);
  };

  const stop = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke || busy) return;
    setBusy(true);
    try {
      const geo = await getCurrentPosition({ ...BEST_EFFORT_OPTIONS });
      const capture = buildSignatureCapture({
        pngDataUrl: canvas.toDataURL("image/png"),
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        accuracyM: geo?.accuracy ?? null,
      });
      setConfirmed(capture);
      onConfirmed(capture);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-ck-border bg-ck-slate p-3 space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        {roleLabel ? <span className="text-xs font-semibold text-ck-cobalt">{roleLabel}</span> : null}
      </div>
      <div
        className="relative overflow-hidden rounded-md border border-ck-border bg-white"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block h-36 w-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        {!hasStroke && !confirmed ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-slate-400">Sign here</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={clear}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-ck-steel hover:text-slate-100"
        >
          <RotateCcw className="h-4 w-4" /> Clear
        </button>
        <button
          type="button"
          disabled={!hasStroke || busy || Boolean(confirmed)}
          onClick={() => void confirm()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ck-cobalt px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirm signature
        </button>
      </div>
      {confirmed ? (
        <div className="rounded-md border border-ck-emerald/40 bg-ck-midnight/50 px-3 py-2 text-[11px] leading-relaxed text-ck-steel">
          <p className="font-semibold text-ck-emerald">Signature locked</p>
          <p>UTC: {confirmed.signedAtUtc}</p>
          <p>AWST: {confirmed.signedAtAwst}</p>
          <p>
            Geo:{" "}
            {confirmed.lat != null && confirmed.lng != null
              ? `${confirmed.lat.toFixed(5)}, ${confirmed.lng.toFixed(5)}`
              : "not available"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
