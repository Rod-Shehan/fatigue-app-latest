/**
 * One-off: build print HTML from frms-python-integration.md
 * Run: node docs/architecture/build-frms-print-html.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const dir = dirname(fileURLToPath(import.meta.url));
const mdPath = join(dir, "frms-python-integration.md");
const outPath = join(dir, "frms-python-integration-print.html");

const md = readFileSync(mdPath, "utf8");

// Replace mermaid block with printable ASCII flow
const mdForPrint = md.replace(
  /```mermaid[\s\S]*?```/,
  `\`\`\`text
Client (React Query)
  manager-view → GET /api/manager/compliance
  ManagerRiskTimelineDashboard → GET /api/manager/risk-timeline
  sheet-detail → PATCH /api/sheets/[id]

Write paths → orchestrator (invalidate + enqueue)
  POST /api/driver/risk-blocks

Read paths → serve FrmsProfileRun cache first
  → src/lib/frms/orchestrator.ts
  → src/lib/frms/build-timeline-payload.ts
  → src/lib/frms/python-client.ts → FastAPI

Async: POST /api/internal/frms/recompute
       POST /api/internal/frms/callback (optional)
       Vercel Cron → fleet recompute
\`\`\``
);

const body = marked.parse(mdForPrint);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Circadia24 — FRMS Python Integration (print)</title>
  <style>
    :root { font-size: 11pt; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, Helvetica, Arial, sans-serif;
      line-height: 1.45;
      color: #111;
      background: #fff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 15mm;
    }
    .print-banner {
      border: 1px solid #ccc;
      padding: 10px 14px;
      margin-bottom: 1.5rem;
      font-size: 10pt;
      background: #f8f8f8;
    }
    .print-banner strong { display: block; margin-bottom: 4px; }
    h1 { font-size: 1.6rem; margin-top: 0; page-break-after: avoid; }
    h2 { font-size: 1.2rem; margin-top: 1.4rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }
    h3 { font-size: 1.05rem; page-break-after: avoid; }
    p, li { orphans: 3; widows: 3; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 9.5pt; page-break-inside: avoid; }
    th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eee; font-weight: 600; }
    code { font-family: Consolas, "Courier New", monospace; font-size: 0.88em; background: #f3f3f3; padding: 1px 4px; }
    pre {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 10px 12px;
      overflow-x: auto;
      font-size: 8pt;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
      page-break-inside: auto;
    }
    pre code { background: none; padding: 0; font-size: inherit; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5rem 0; }
    a { color: #111; text-decoration: underline; }
    @media print {
      body { padding: 0; max-width: none; }
      .no-print { display: none !important; }
      h2 { page-break-before: auto; }
      pre { border-color: #999; }
    }
  </style>
</head>
<body>
  <div class="print-banner no-print">
    <strong>Print this document</strong>
    Press <kbd>Ctrl+P</kbd> (Windows) or <kbd>Cmd+P</kbd> (Mac), then choose &quot;Save as PDF&quot; or your printer.
    Source: app-next/docs/architecture/frms-python-integration.md
  </div>
  <article class="doc">
${body}
  </article>
  <footer style="margin-top:2rem;font-size:9pt;color:#666;border-top:1px solid #ccc;padding-top:8px;">
    Circadia24 · FRMS Python integration · Proposed 2026-06 · fatigue-app-latest
  </footer>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log("Wrote", outPath);
