import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOTAL_MIN = 24 * 60;
const GREY_TEXT = [30, 30, 30] as [number, number, number];
const GREY_LABEL = [80, 80, 80] as [number, number, number];
const GREY_LIGHT = [240, 240, 240] as [number, number, number];
const GREY_WORK = [55, 55, 55] as [number, number, number];
const GREY_BREAK = [115, 115, 115] as [number, number, number];
const GREY_NON_WORK = [200, 200, 200] as [number, number, number];
const ROW_LABELS = ["Work", "Breaks", "Non-Work Time"] as const;

function getDateStr(weekStarting: string | null, dayIndex: number): string {
  if (!weekStarting) return "—";
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dayIndex);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

function slotsToRanges(
  slots: boolean[] | undefined,
  capAtMin: number
): { startMin: number; endMin: number }[] {
  if (!slots || slots.length < 48) return [];
  const ranges: { startMin: number; endMin: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < 48; i++) {
    const slotStart = i * 30;
    const slotEnd = (i + 1) * 30;
    const on = !!slots[i];
    if (on && start === null) start = slotStart;
    if (!on && start !== null) {
      ranges.push({ startMin: start, endMin: Math.min(slotStart, capAtMin) });
      start = null;
    }
    if (on && i === 47) {
      ranges.push({ startMin: start!, endMin: Math.min(slotEnd, capAtMin) });
    }
  }
  return ranges;
}

function getEffectiveDayEndMinutes(dateStr: string, todayStr: string): number {
  if (dateStr > todayStr) return 0;
  if (dateStr < todayStr) return TOTAL_MIN;
  const dayStart = new Date(dateStr + "T00:00:00").getTime();
  return Math.min(TOTAL_MIN, Math.ceil((Date.now() - dayStart) / 60000));
}

function rangesToGaps(
  ranges: { startMin: number; endMin: number }[],
  totalMin: number
): { startMin: number; endMin: number }[] {
  if (ranges.length === 0) return [{ startMin: 0, endMin: totalMin }];
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: { startMin: number; endMin: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startMin <= last.endMin) last.endMin = Math.max(last.endMin, r.endMin);
    else merged.push({ startMin: r.startMin, endMin: r.endMin });
  }
  const gaps: { startMin: number; endMin: number }[] = [];
  let pos = 0;
  for (const r of merged) {
    if (r.startMin > pos) gaps.push({ startMin: pos, endMin: r.startMin });
    pos = Math.max(pos, r.endMin);
  }
  if (pos < totalMin) gaps.push({ startMin: pos, endMin: totalMin });
  return gaps;
}

function buildSegmentsFromEvents(
  events: { time: string; type: string }[] | undefined,
  dateStr: string,
  effectiveEndMin: number
): { work_time: { startMin: number; endMin: number }[]; breaks: { startMin: number; endMin: number }[]; non_work: { startMin: number; endMin: number }[] } {
  const segments = {
    work_time: [] as { startMin: number; endMin: number }[],
    breaks: [] as { startMin: number; endMin: number }[],
    non_work: [] as { startMin: number; endMin: number }[],
  };
  const dayStart = new Date(dateStr + "T00:00:00").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59").getTime();
  if (!events?.length) {
    if (effectiveEndMin > 0) segments.non_work = [{ startMin: 0, endMin: effectiveEndMin }];
    return segments;
  }
  const MIN_BREAK_BLOCK_MINUTES = 10;
  const workOrBreakRanges: { startMin: number; endMin: number }[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === "stop") continue;
    const end = events[i + 1] ? new Date(events[i + 1].time).getTime() : Date.now();
    const clampedEnd = Math.min(end, dayEnd);
    const start = new Date(ev.time).getTime();
    const clampedStart = Math.max(start, dayStart);
    if (clampedStart >= clampedEnd) continue;
    let startMin = Math.floor((clampedStart - dayStart) / 60000);
    let endMin = Math.min(effectiveEndMin, Math.ceil((clampedEnd - dayStart) / 60000));
    if (startMin >= endMin) continue;
    const durationMinutes = endMin - startMin;
    const treatBreakAsWork = ev.type === "break" && durationMinutes < MIN_BREAK_BLOCK_MINUTES;
    if (ev.type === "work" || treatBreakAsWork) {
      segments.work_time.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    } else if (ev.type === "break") {
      segments.breaks.push({ startMin, endMin });
      workOrBreakRanges.push({ startMin, endMin });
    }
  }
  if (effectiveEndMin > 0) segments.non_work = rangesToGaps(workOrBreakRanges, effectiveEndMin);
  return segments;
}

function getDaySegments(
  day: { work_time?: boolean[]; breaks?: boolean[]; non_work?: boolean[]; events?: { time: string; type: string }[] },
  dateStr: string,
  todayStr: string
): { work_time: { startMin: number; endMin: number }[]; breaks: { startMin: number; endMin: number }[]; non_work: { startMin: number; endMin: number }[] } {
  const effectiveEndMin = getEffectiveDayEndMinutes(dateStr, todayStr);
  const events = day?.events || [];
  const slotBased = day?.work_time != null && day?.breaks != null && day?.non_work != null;
  if (events.length > 0) {
    return buildSegmentsFromEvents(events, dateStr, effectiveEndMin);
  }
  if (slotBased) {
    return {
      work_time: slotsToRanges(day.work_time!.map((w, i) => w && !day.breaks![i]), TOTAL_MIN),
      breaks: slotsToRanges(day.breaks, TOTAL_MIN),
      non_work: slotsToRanges(day.non_work, effectiveEndMin),
    };
  }
  return buildSegmentsFromEvents(undefined, dateStr, effectiveEndMin);
}

function getTotalMinutes(segs: { startMin: number; endMin: number }[]): number {
  return segs.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
}

function formatHours(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getIsoDate(weekStarting: string | null, dayIndex: number): string {
  if (!weekStarting) return new Date().toISOString().slice(0, 10);
  const [y, m, d] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, d + dayIndex);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const row = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (!canAccessSheet(row, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let days: Array<{
        work_time?: boolean[];
        breaks?: boolean[];
        non_work?: boolean[];
        date?: string;
        truck_rego?: string;
        destination?: string;
        start_kms?: number;
        end_kms?: number;
        events?: Array<{ time: string; type: string }>;
      }>;
    try {
      const parsed = row.days ? JSON.parse(row.days) : [];
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }

    const sheet = {
      driver_name: row.driverName,
      second_driver: row.secondDriver,
      driver_type: row.driverType,
      destination: row.destination,
      week_starting: row.weekStarting,
      days,
      status: row.status,
      signature: row.signature,
      signed_at: row.signedAt?.toISOString() ?? null,
    };

    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 14;
    const colW = pageW - margin * 2;
    const todayStr = new Date().toISOString().slice(0, 10);
    let y = 30;
    const labelW = 22;
    const subtotalW = 14;
    const barW = colW - labelW - subtotalW - 4;
    const barLeft = margin + labelW;
    const rowH = 4;
    const tilePadding = 3;
    const tickH = 4;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FATIGUE RECORD SHEET", margin, 11);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("WA Commercial Driver Fatigue Management", margin, 18);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" })}`,
      pageW - margin,
      18,
      { align: "right" }
    );

    const dayList = (sheet.days || []).slice(0, 7);
    while (dayList.length < 7) dayList.push({});

    dayList.forEach((day, idx) => {
      if (y > 258) {
        doc.addPage();
        y = 20;
      }
      const dayName = DAY_NAMES[idx] ?? `Day ${idx + 1}`;
      const dateStr = getDateStr(sheet.week_starting, idx);
      const isoDate = (day as { date?: string }).date || getIsoDate(sheet.week_starting, idx);
      const segments = getDaySegments(day, isoDate, todayStr);

      const tileContentH = 10 + 6 + tickH + 3 * rowH + 3 * 1.5 + 4;
      const tileH = tileContentH + tilePadding * 2;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(...GREY_LIGHT);
      doc.rect(margin, y - tilePadding, colW, tileH, "FD");
      y += 2;

      doc.setFillColor(30, 30, 30);
      doc.rect(margin + 2, y - 3.5, 5, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(dayName.charAt(0), margin + 4.5, y + 0.2, { align: "center" });
      doc.setTextColor(...GREY_TEXT);
      doc.setFontSize(10);
      doc.text(dayName, margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GREY_LABEL);
      doc.text(dateStr, margin + 10, y + 5);
      const dayWithKms = day as { truck_rego?: string; destination?: string; start_kms?: number; end_kms?: number };
      const rego = dayWithKms.truck_rego ?? "";
      const dest = dayWithKms.destination ?? "";
      const startKms = dayWithKms.start_kms ?? null;
      const endKms = dayWithKms.end_kms ?? null;
      const kmsTotal = startKms != null && endKms != null ? Math.max(0, endKms - startKms) : null;
      const metaParts: string[] = [];
      if (rego) metaParts.push(`Rego: ${rego}`);
      if (dest) metaParts.push(dest);
      if (startKms != null) metaParts.push(`Start: ${startKms} km`);
      if (endKms != null) metaParts.push(`End: ${endKms} km`);
      if (kmsTotal != null) metaParts.push(`Total: ${kmsTotal} km`);
      if (metaParts.length) {
        doc.setFontSize(8);
        doc.text(metaParts.join("  •  "), margin + 2, y + 10);
      }
      y += 10 + 6;

      doc.setFontSize(7);
      doc.setTextColor(...GREY_LABEL);
      for (let h = 0; h <= 24; h += 2) {
        const x = barLeft + (h / 24) * barW;
        doc.text(String(h).padStart(2, "0"), x, y + tickH * 0.7, { align: "center" });
      }
      y += tickH + 1;

      ROW_LABELS.forEach((label, ri) => {
        const key = ["work_time", "breaks", "non_work"][ri] as keyof typeof segments;
        const segs = segments[key];
        const totalMins = getTotalMinutes(segs);
        const fill = [GREY_WORK, GREY_BREAK, GREY_NON_WORK][ri];
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GREY_LABEL);
        doc.text(label, margin + labelW - 1, y + rowH * 0.7, { align: "right" });
        doc.setFillColor(230, 230, 230);
        doc.rect(barLeft, y, barW, rowH, "F");
        segs.forEach((seg) => {
          const left = (seg.startMin / TOTAL_MIN) * barW;
          const w = Math.max(0.5, ((seg.endMin - seg.startMin) / TOTAL_MIN) * barW);
          doc.setFillColor(...fill);
          doc.rect(barLeft + left, y, w, rowH, "F");
        });
        doc.setDrawColor(200, 200, 200);
        doc.rect(barLeft, y, barW, rowH, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...(totalMins > 0 ? GREY_TEXT : GREY_LABEL));
        doc.text(formatHours(totalMins), barLeft + barW + 2, y + rowH * 0.7);
        y += rowH + 1.5;
      });

      y += tilePadding + 4;
    });

    y += 4;
    if (sheet.signature) {
      if (y > 220) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(...GREY_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("DRIVER SIGNATURE", margin, y);
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, 80, 30);
      try {
        doc.addImage(sheet.signature, "PNG", margin + 1, y + 1, 78, 28);
      } catch {
        /* skip if image fails */
      }
      if (sheet.signed_at) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GREY_LABEL);
        doc.text(
          `Signed: ${new Date(sheet.signed_at).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}`,
          margin,
          y + 34
        );
      }
    }

    const pdfBytes = doc.output("arraybuffer");
    const timeStamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    // Sanitize filename to prevent header injection (quotes, newlines, control chars)
    const safeName = (sheet.driver_name || "unknown")
      .replace(/[\s"\r\n\\]+/g, "-")
      .replace(/[^\w\-.]/g, "") || "sheet";
    const filename = `fatigue-sheet-${safeName}-${timeStamp}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
