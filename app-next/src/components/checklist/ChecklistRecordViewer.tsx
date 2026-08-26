"use client";

import { useState } from "react";
import {
  CHECKLIST_EMAIL_BUTTON_LABEL,
  CHECKLIST_PDF_BUTTON_LABEL,
  checklistAuditIdentity,
  checklistFaultMobilityLabel,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "@/lib/checklist";
import { ChecklistModalShell } from "./ChecklistModalShell";
import { cn } from "@/lib/utils";

const TYPE_TITLE: Record<ChecklistRecordType, string> = {
  ffw: "Fitness for Work",
  prestart: "Prestart inspection",
  dimension_load: "Dimension & Load",
};

const LOADER_PATH_LABEL: Record<string, string> = {
  present: "Loader present — signed",
  pending: "Loader pending — CoR not yet obtained",
  not_obtained: "Loader CoR not obtained — photo evidence",
  self_as_loader: "Driver also loaded — dual signatures",
};

function itemValueLabel(value: string): string {
  switch (value) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fault";
    case "na":
      return "N/A";
    case "acknowledged":
      return "Acknowledged";
    default:
      return value;
  }
}

function formatCompletedWhen(record: ChecklistRecord): string {
  const driver = record.signatures.find((s) => s.role === "driver");
  if (driver?.signedAtAwst) return driver.signedAtAwst;
  try {
    return new Date(record.completedAtUtc).toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
    });
  } catch {
    return record.completedAtUtc;
  }
}

function RecordBody({ record, index, total }: { record: ChecklistRecord; index: number; total: number }) {
  const identity = checklistAuditIdentity(record);
  const headerEntries = Object.entries(record.header ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );

  return (
    <article className="space-y-3 rounded-xl border border-ck-border bg-ck-slate p-3">
      {total > 1 ? (
        <p className="text-xs font-bold uppercase tracking-wide text-ck-steel">
          Record {index + 1} of {total}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-ck-fg">{identity.summary}</p>
      <p className="text-xs text-ck-steel">
        {identity.primaryLabel}: {identity.primaryValue}
        {identity.secondaryValue ? ` · ${identity.secondaryLabel}: ${identity.secondaryValue}` : ""}
      </p>
      <p className="text-sm text-ck-fg">
        Completed{" "}
        <span className="font-semibold tabular-nums">{formatCompletedWhen(record)}</span>
        <span className="text-ck-steel"> (AWST)</span>
      </p>

      {headerEntries.length > 0 ? (
        <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {headerEntries.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-ck-steel capitalize">{k.replace(/_/g, " ")}</dt>
              <dd className="font-medium text-ck-fg truncate">{String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {record.type === "prestart" && record.prestartResponsible === false ? (
        <div className="rounded-lg border border-ck-border bg-ck-midnight/60 p-2 text-sm text-ck-fg">
          <p className="font-semibold">Not responsible for prestart</p>
          <p className="mt-1 text-ck-steel">{record.prestartSkipReason || "—"}</p>
        </div>
      ) : null}

      {record.loaderPath ? (
        <p className="text-xs text-ck-steel">
          Loader path:{" "}
          <span className="font-semibold text-ck-fg">
            {LOADER_PATH_LABEL[record.loaderPath] ?? record.loaderPath}
          </span>
          {record.loaderName ? (
            <>
              {" "}
              · <span className="text-ck-fg">{record.loaderName}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {record.items.length > 0 ? (
        <ul className="space-y-2">
          {record.items.map((item) => (
            <li
              key={item.code}
              className="rounded-lg border border-ck-border bg-ck-midnight/50 px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-ck-fg">{item.label || item.code}</span>
                <span
                  className={`shrink-0 text-xs font-bold uppercase tracking-wide ${
                    item.value === "fail"
                      ? "text-ck-red"
                      : item.value === "pass" || item.value === "acknowledged"
                        ? "text-ck-emerald"
                        : "text-ck-steel"
                  }`}
                >
                  {itemValueLabel(item.value)}
                </span>
              </div>
              {item.kind === "pass_fail" && item.value === "fail" && item.defect ? (
                <div className="mt-2 space-y-1 text-xs text-ck-steel">
                  <p className="text-ck-fg">{item.defect.description}</p>
                  {checklistFaultMobilityLabel(item.defect.mobilityStatus) ? (
                    <p>{checklistFaultMobilityLabel(item.defect.mobilityStatus)}</p>
                  ) : null}
                  {(item.defect.photoDataUrls?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.defect.photoDataUrls!.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt={`Fault photo ${i + 1}`}
                          className="h-14 w-14 rounded object-cover border border-ck-border"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {record.actionedFaultText ? (
        <div className="rounded-lg border border-ck-red/40 bg-ck-midnight/60 p-2 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-ck-red">Actioned fault</p>
          <p className="mt-1 whitespace-pre-wrap text-ck-fg">{record.actionedFaultText}</p>
        </div>
      ) : null}

      {(record.evidencePhotoDataUrls?.length ?? 0) > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-ck-steel">Evidence photos</p>
          <div className="flex flex-wrap gap-2">
            {record.evidencePhotoDataUrls!.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`Evidence ${i + 1}`}
                className="h-16 w-16 rounded object-cover border border-ck-border"
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ck-steel">Signatures</p>
        {record.signatures.map((sig, i) => (
          <div key={`${sig.role}-${i}`} className="rounded-lg border border-ck-border bg-white p-2">
            <p className="mb-1 text-xs font-semibold text-ck-fg capitalize">
              {sig.role === "loader" ? "As loader" : "As driver"}
              {sig.signedAtAwst ? (
                <span className="ml-2 font-normal text-ck-steel">{sig.signedAtAwst}</span>
              ) : null}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sig.pngDataUrl}
              alt={`${sig.role} signature`}
              className="h-16 w-full object-contain bg-white"
            />
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Read-only view of completed checklist record(s) for a day.
 * Does not edit prior answers — use redo / add another for a new signed record.
 */
export function ChecklistRecordViewer({
  open,
  onClose,
  type,
  records,
  onRedo,
  redoLabel,
  onProducePdf,
  onEmailPdf,
  periodNoun = "day",
}: {
  open: boolean;
  onClose: () => void;
  type: ChecklistRecordType;
  records: ChecklistRecord[];
  onRedo?: () => void;
  redoLabel?: string;
  /** Dedicated checklist PDF (not fatigue roadside). */
  onProducePdf?: () => void;
  /** Email week pack for this type; return success message for on-screen feedback. */
  onEmailPdf?: () => Promise<string>;
  /** “this day” vs “this week” in the empty-state line. */
  periodNoun?: "day" | "week";
}) {
  const title = TYPE_TITLE[type];
  const list = records.filter((r) => r.type === type && r.status === "completed");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  return (
    <ChecklistModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={
        list.length === 0
          ? `No saved form for this ${periodNoun}`
          : list.length === 1
            ? "Saved record (read only)"
            : `${list.length} saved records (read only)`
      }
      footer={
        <div className="flex flex-col gap-2">
          {onProducePdf && list.length > 0 ? (
            <button
              type="button"
              onClick={onProducePdf}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-ck-border bg-ck-midnight text-sm font-bold text-ck-fg"
            >
              {CHECKLIST_PDF_BUTTON_LABEL}
            </button>
          ) : null}
          {onEmailPdf && list.length > 0 ? (
            <>
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => {
                  void (async () => {
                    setEmailFeedback(null);
                    setEmailBusy(true);
                    try {
                      const text = await onEmailPdf();
                      setEmailFeedback({
                        tone: "ok",
                        text: text || "Sent to Circadia.",
                      });
                    } catch (e) {
                      setEmailFeedback({
                        tone: "err",
                        text:
                          e instanceof Error
                            ? e.message
                            : "Could not email checklist PDF.",
                      });
                    } finally {
                      setEmailBusy(false);
                    }
                  })();
                }}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-ck-border bg-ck-midnight text-sm font-bold text-ck-fg disabled:opacity-60"
              >
                {emailBusy
                  ? "Sending…"
                  : CHECKLIST_EMAIL_BUTTON_LABEL.replace("packs", "pack")}
              </button>
              {emailFeedback ? (
                <p
                  role="status"
                  className={cn(
                    "rounded-lg px-3 py-2 text-center text-sm leading-snug",
                    emailFeedback.tone === "ok"
                      ? "bg-ck-emerald/15 text-ck-fg"
                      : "bg-ck-red/15 text-ck-red"
                  )}
                >
                  {emailFeedback.text}
                </p>
              ) : null}
            </>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {onRedo ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRedo();
                }}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-ck-border bg-ck-midnight text-sm font-bold text-ck-fg"
              >
                {redoLabel ?? (type === "dimension_load" ? "Add another" : "Complete again")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-ck-cobalt text-sm font-bold text-ck-on-accent"
            >
              Close
            </button>
          </div>
          <p className="text-center text-[10px] text-ck-steel leading-snug">
            Week pack for this form type only — separate from other checklist types and from the
            28-day fatigue roadside PDF.
          </p>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        {list.length === 0 ? (
          <p className="text-sm text-ck-steel">
            Nothing saved yet for this check. Use Open form to complete one.
          </p>
        ) : (
          [...list].reverse().map((record, i, arr) => (
            <RecordBody key={record.id} record={record} index={arr.length - 1 - i} total={arr.length} />
          ))
        )}
      </div>
    </ChecklistModalShell>
  );
}
