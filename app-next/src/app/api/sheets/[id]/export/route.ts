import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOTAL_MIN = 24 * 60;
const GREY_TEXT = [30, 30, 30] as [number, number, number];
const GREY_LABEL = [80, 80, 80] as [number, number, number];
const GREY_LIGHT = [240, 240, 240] as [number, number, number];
// Darker fills so recorded time is more obvious on print/PDF viewers.
const GREY_WORK = [35, 35, 35] as [number, number, number];
const GREY_BREAK = [90, 90, 90] as [number, number, number];
const GREY_NON_WORK = [180, 180, 180] as [number, number, number];

type SegmentType = "work" | "break" | "non_work";
type TimelineSegment = { startMin: number; endMin: number; type: SegmentType };
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
  // For "today", cap at the current local time in Australia/Perth so the PDF
  // matches what drivers see in-app.
  const { hour, minute } = getPerthNowParts();
  return Math.min(TOTAL_MIN, hour * 60 + minute);
}

function getPerthNowParts(): { ymd: string; hour: number; minute: number } {
  // Avoid relying on runtime timezone databases (some server environments fall back to UTC).
  // Perth is always UTC+8 (no daylight saving), so compute it explicitly from UTC.
  const PERTH_OFFSET_MIN = 8 * 60;
  // Date.now()/getTime() are already milliseconds since epoch (UTC).
  const perth = new Date(Date.now() + PERTH_OFFSET_MIN * 60_000);
  const y = perth.getUTCFullYear();
  const m = perth.getUTCMonth() + 1;
  const d = perth.getUTCDate();
  const hour = perth.getUTCHours();
  const minute = perth.getUTCMinutes();
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { ymd, hour, minute };
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function segmentsToTimeline(segments: {
  work_time: { startMin: number; endMin: number }[];
  breaks: { startMin: number; endMin: number }[];
  non_work: { startMin: number; endMin: number }[];
}): TimelineSegment[] {
  const all: TimelineSegment[] = [
    ...segments.work_time.map((s) => ({ ...s, type: "work" as const })),
    ...segments.breaks.map((s) => ({ ...s, type: "break" as const })),
    ...segments.non_work.map((s) => ({ ...s, type: "non_work" as const })),
  ]
    .filter((s) => s.endMin > s.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Merge touching segments of the same type to keep the table concise.
  const merged: TimelineSegment[] = [];
  for (const s of all) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type && s.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, s.endMin);
    } else if (last && last.type === s.type && s.startMin === last.endMin) {
      last.endMin = s.endMin;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

function segmentLabel(type: SegmentType): string {
  if (type === "work") return "Work";
  if (type === "break") return "Break";
  return "Rest";
}

function segmentFill(type: SegmentType): [number, number, number] {
  if (type === "work") return GREY_WORK;
  if (type === "break") return GREY_BREAK;
  return GREY_NON_WORK;
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

    const audit = await prisma.auditEvent.findMany({
      where: { sheetId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        createdAt: true,
        action: true,
        payload: true,
        actor: { select: { email: true, name: true } },
      },
    });

    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 14;
    const colW = pageW - margin * 2;
    const todayStr = getPerthNowParts().ymd;
    let y = 30;
    const labelW = 22;
    const subtotalW = 16;
    const barW = colW - labelW - subtotalW - 4;
    const barLeft = margin + labelW;
    const tilePadding = 3;
    const tickH = 4;
    const rowH = 3;
    const rowGap = 1.2;

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
      const timeline = segmentsToTimeline(segments);

      // Header (day + meta) + hour labels + 3-row bars + table header + up to N rows.
      const maxRows = 8;
      const rowCount = Math.min(maxRows, timeline.length);
      const tableRowH = 4.2;
      const tableH = 5.5 + rowCount * tableRowH + 2;
      const barsH = 3 * rowH + 2 * rowGap;
      const tileContentH = 10 + 6 + tickH + 1 + barsH + 2 + tableH + 4;
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

      // 3-row time bars (original style, higher contrast)
      const rowsCfg = [
        { label: ROW_LABELS[0], segs: segments.work_time, fill: GREY_WORK },
        { label: ROW_LABELS[1], segs: segments.breaks, fill: GREY_BREAK, hatch: true },
        { label: ROW_LABELS[2], segs: segments.non_work, fill: GREY_NON_WORK },
      ] as const;

      rowsCfg.forEach((r, ri) => {
        const totalMins = getTotalMinutes(r.segs);

        // Row label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text(r.label, margin + labelW - 1, y + rowH * 0.7, { align: "right" });

        // Background with hour banding
        for (let h = 0; h < 24; h++) {
          const x = barLeft + (h / 24) * barW;
          const w = barW / 24;
          const isAlt = h % 2 === 0;
          doc.setFillColor(isAlt ? 250 : 238, isAlt ? 250 : 238, isAlt ? 250 : 238);
          doc.rect(x, y, w, rowH, "F");
        }

        // Hour grid lines (strong on 2-hour, light on 1-hour)
        for (let h = 0; h <= 24; h++) {
          const x = barLeft + (h / 24) * barW;
          const strong = h % 2 === 0;
          doc.setDrawColor(strong ? 160 : 205, strong ? 160 : 205, strong ? 160 : 205);
          doc.setLineWidth(strong ? 0.25 : 0.12);
          doc.line(x, y, x, y + rowH);
        }

        // Segments fill
        doc.setLineWidth(0.2);
        r.segs.forEach((seg) => {
          const left = (seg.startMin / TOTAL_MIN) * barW;
          const w = Math.max(0.7, ((seg.endMin - seg.startMin) / TOTAL_MIN) * barW);
          doc.setFillColor(...r.fill);
          doc.rect(barLeft + left, y, w, rowH, "F");
          if ("hatch" in r && r.hatch) {
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.1);
            const x0 = barLeft + left;
            const x1 = x0 + w;
            for (let lx = x0 - rowH; lx < x1 + rowH; lx += 2.4) {
              doc.line(lx, y + rowH, lx + rowH, y);
            }
          }
        });

        // Strong outline
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.35);
        doc.rect(barLeft, y, barW, rowH, "S");

        // Subtotal at right
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text(formatHours(totalMins), barLeft + barW + 2, y + rowH * 0.7);

        y += rowH + (ri === 2 ? 2 : rowGap);
      });

      // Segment list table (audit-proof detail)
      const tableLeft = margin + 2;
      const tableW = colW - 4;
      const colStartW = 18;
      const colEndW = 18;
      const colDurW = 18;
      const colTypeW = 22;
      const colNotesW = tableW - (colStartW + colEndW + colDurW + colTypeW);

      doc.setDrawColor(210, 210, 210);
      doc.setFillColor(250, 250, 250);
      doc.rect(tableLeft, y, tableW, 5.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY_LABEL);
      const thY = y + 3.8;
      doc.text("Start", tableLeft + 1.5, thY);
      doc.text("End", tableLeft + colStartW + 1.5, thY);
      doc.text("Dur", tableLeft + colStartW + colEndW + 1.5, thY);
      doc.text("Type", tableLeft + colStartW + colEndW + colDurW + 1.5, thY);
      doc.text("Notes", tableLeft + colStartW + colEndW + colDurW + colTypeW + 1.5, thY);
      y += 5.5;

      const rows = timeline.slice(0, maxRows);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      rows.forEach((seg, i) => {
        const rowY = y + i * tableRowH;
        const isAlt = i % 2 === 0;
        doc.setFillColor(isAlt ? 255 : 252, isAlt ? 255 : 252, isAlt ? 255 : 252);
        doc.rect(tableLeft, rowY, tableW, tableRowH, "F");
        doc.setDrawColor(230, 230, 230);
        doc.line(tableLeft, rowY + tableRowH, tableLeft + tableW, rowY + tableRowH);

        doc.setTextColor(...GREY_TEXT);
        doc.text(minToHHMM(seg.startMin), tableLeft + 1.5, rowY + 3);
        doc.text(minToHHMM(seg.endMin), tableLeft + colStartW + 1.5, rowY + 3);
        doc.text(formatDuration(seg.endMin - seg.startMin), tableLeft + colStartW + colEndW + 1.5, rowY + 3);
        doc.text(segmentLabel(seg.type), tableLeft + colStartW + colEndW + colDurW + 1.5, rowY + 3);

        // Notes: kept for future (e.g., GPS, rego, destination, or compliance markers).
        const note =
          seg.type === "break"
            ? "Break recorded"
            : seg.type === "work"
              ? "Work recorded"
              : "";
        const clipped = doc.splitTextToSize(note, colNotesW - 3);
        if (clipped?.[0]) {
          doc.setTextColor(...GREY_LABEL);
          doc.text(String(clipped[0]), tableLeft + colStartW + colEndW + colDurW + colTypeW + 1.5, rowY + 3);
        }
      });
      y += rows.length * tableRowH + 2;

      if (timeline.length > maxRows) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GREY_LABEL);
        doc.text(`(+${timeline.length - maxRows} more segments)`, margin + 2, y + 2.5);
        y += 4;
      }

      y += tilePadding + 4;
    });

    // Audit trail appendix (snapshot of edit history)
    if (audit.length > 0) {
      doc.addPage();
      let ay = 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text("AUDIT TRAIL (Appendix)", margin, ay);
      ay += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(
        "Append-only log of sheet changes captured by the system. Times shown in Australia/Perth.",
        margin,
        ay
      );
      ay += 6;

      doc.setTextColor(30, 30, 30);
      const maxLines = 200;
      const rows = audit.slice(Math.max(0, audit.length - maxLines));
      for (const e of rows) {
        const who = e.actor?.name || e.actor?.email || "unknown";
        const when = new Date(e.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Perth" });
        const action = e.action;
        const changed =
          e.payload && typeof e.payload === "object" && "changed_fields" in (e.payload as any)
            ? (e.payload as any).changed_fields
            : undefined;
        const line = `${when} — ${action}${who ? ` — ${who}` : ""}${Array.isArray(changed) ? ` — ${changed.join(", ")}` : ""}`;
        const wrapped = doc.splitTextToSize(line, colW);
        if (ay + wrapped.length * 4 > 280) {
          doc.addPage();
          ay = 16;
        }
        doc.text(wrapped, margin, ay);
        ay += wrapped.length * 4 + 1;
      }
    }

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
