"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pen, RotateCcw, CheckCircle2 } from "lucide-react";

const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 160;
const INK_COLOR = "#0f172a";

function resetCanvasSurface(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export default function SignatureDialog({
  open,
  onConfirm,
  onCancel,
  driverName,
}: {
  open: boolean;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  driverName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resetCanvasSurface(canvas);
    setHasSignature(false);
    isDrawingRef.current = false;
    lastPos.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    clearCanvas();
  }, [open, clearCanvas]);

  const getPos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    lastPos.current = getPos(e.clientX, e.clientY, canvas);
    isDrawingRef.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPos.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e.clientX, e.clientY, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="w-4 h-4" /> Driver Signature
          </DialogTitle>
          <DialogDescription>
            {driverName
              ? `${driverName} — please sign below to confirm this weekly record is accurate.`
              : "Please sign below to confirm this weekly record is accurate."}
          </DialogDescription>
        </DialogHeader>
        <div
          className="border-2 border-slate-300 dark:border-slate-500 rounded-lg overflow-hidden bg-white relative"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full h-40 cursor-crosshair touch-none bg-white"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-slate-400 text-sm font-medium select-none">Sign here</span>
            </div>
          )}
          <div className="absolute bottom-8 left-6 right-6 border-b border-dashed border-slate-300 pointer-events-none" />
        </div>
        <div className="flex items-center justify-between mt-1">
          <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-slate-500 gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!hasSignature}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 disabled:opacity-40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm &amp; Complete
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center -mt-1">
          By signing, the driver confirms this record is true and correct — WA Heavy Vehicle National Law
        </p>
      </DialogContent>
    </Dialog>
  );
}
