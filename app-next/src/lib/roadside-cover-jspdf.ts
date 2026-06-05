import { formatProduceWindowLabel } from "@/lib/roadside-produce";
import { ROADSIDE_PDF_DISCLAIMER } from "@/lib/roadside-pdf";

/** Cover page for 28-day roadside PDF (browser-safe — no Puppeteer). */
export async function buildProduceCoverPdfBytes(opts: {
  driverName: string;
  fromYmd: string;
  toYmd: string;
  weekCount: number;
  generatedAtLabel: string;
}): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const colW = 210 - margin * 2;
  let y = 24;

  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.6);
  doc.rect(margin, y - 6, colW, 72, "FD");

  doc.setTextColor(120, 53, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Roadside produce — driver record", margin + 4, y + 4);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 50, 20);
  const lead = doc.splitTextToSize(
    `Last 28 calendar days of weekly fatigue records for inspection (${formatProduceWindowLabel(opts.fromYmd, opts.toYmd)}). Times in Australia/Perth.`,
    colW - 8
  );
  doc.text(lead, margin + 4, y);
  y += lead.length * 4 + 4;

  doc.setFontSize(9);
  doc.text(`Driver: ${opts.driverName}`, margin + 4, y);
  y += 5;
  doc.text(`Weeks included: ${opts.weekCount}`, margin + 4, y);
  y += 5;
  doc.text(`Generated: ${opts.generatedAtLabel}`, margin + 4, y);
  y += 8;

  doc.setFontSize(7);
  const disc = doc.splitTextToSize(ROADSIDE_PDF_DISCLAIMER, colW - 8);
  doc.text(disc, margin + 4, y);

  return doc.output("arraybuffer");
}
