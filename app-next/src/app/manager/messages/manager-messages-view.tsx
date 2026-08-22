"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { ManagerSubnav } from "@/components/manager/ManagerSubnav";
import { MANAGER_EXPERIENCE, MANAGER_PAGE_SHELL } from "@/lib/manager-experience";
import { api } from "@/lib/api";
import { resolveDriverBubbleName } from "@/lib/messaging-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, ExternalLink } from "lucide-react";
import { MessageBubbleRow } from "@/components/messaging/MessageBubbleRow";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function weekLabel(weekStarting: string) {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type ThreadRow = {
  id: string;
  subject: string;
  updatedAt: string;
  createdBy: { name: string | null; email: string | null };
  sheet?: { id: string; week_starting: string; driver_name: string } | null;
  lastMessage?: { body: string; createdAt: string; senderName: string | null } | null;
};

function ThreadListCard({
  thread,
  driverLabel,
  active,
  onSelect,
}: {
  thread: ThreadRow;
  driverLabel: string;
  active: boolean;
  onSelect: () => void;
}) {
  const last = thread.lastMessage?.body?.trim() ?? "";
  const contextLabel = thread.sheet
    ? `Sheet · week of ${weekLabel(thread.sheet.week_starting)}`
    : "General";

  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-colors dark:bg-slate-900",
        active
          ? "border-teal-600 dark:border-teal-500"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 text-left"
        aria-current={active ? "true" : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{thread.subject}</p>
            <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">{driverLabel}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{contextLabel}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
              active
                ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {formatWhen(thread.updatedAt)}
          </span>
        </div>
        {last ? (
          <p className="mt-3 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{last}</p>
        ) : (
          <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">No messages yet</p>
        )}
      </button>
    </article>
  );
}

export function ManagerMessagesView() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [driverSearch, setDriverSearch] = useState("");
  const [compose, setCompose] = useState("");

  const { data: threadsData } = useQuery({
    queryKey: ["messages", "threads"],
    queryFn: () => api.messages.threads(),
    refetchInterval: 7000,
  });
  const threads = threadsData?.threads ?? [];

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });

  const threadDriverLabel = (t: (typeof threads)[0]) =>
    resolveDriverBubbleName(
      drivers,
      { name: t.createdBy.name ?? null, email: t.createdBy.email ?? null },
      null
    );

  const filteredThreads = useMemo(() => {
    const d = driverSearch.trim().toLowerCase();
    return threads.filter((t) => {
      if (d) {
        const label = threadDriverLabel(t).toLowerCase();
        const raw = (t.createdBy.name || t.createdBy.email || "").toLowerCase();
        if (!label.includes(d) && !raw.includes(d)) return false;
      }
      return true;
    });
  }, [threads, driverSearch, drivers]);

  useEffect(() => {
    const fromUrl = (searchParams.get("driver") ?? "").trim();
    if (!fromUrl) return;
    setDriverSearch((prev) => (prev ? prev : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    if (activeThreadId) return;
    if (filteredThreads.length === 1) setActiveThreadId(filteredThreads[0].id);
  }, [activeThreadId, filteredThreads]);

  const activeThread = useMemo(
    () => filteredThreads.find((t) => t.id === activeThreadId) ?? threads.find((t) => t.id === activeThreadId) ?? null,
    [filteredThreads, threads, activeThreadId]
  );

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ["messages", "thread", activeThreadId],
    queryFn: () => api.messages.thread(activeThreadId),
    enabled: !!activeThreadId,
    refetchInterval: 5000,
  });
  const messages = threadData?.messages ?? [];

  const postMutation = useMutation({
    mutationFn: (body: string) => api.messages.postMessage(activeThreadId, { body }),
    onSuccess: () => {
      setCompose("");
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", activeThreadId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "threads"] });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={MANAGER_PAGE_SHELL}>
        <PageHeader
          backHref="/manager"
          backLabel={MANAGER_EXPERIENCE.NAV_RISK_BRIEF}
          backText={MANAGER_EXPERIENCE.NAV_OVERVIEW}
          title={MANAGER_EXPERIENCE.NAV_MESSAGES}
          subtitle={MANAGER_EXPERIENCE.MESSAGES_PAGE_SUBTITLE}
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <ManagerSubnav />

        <div className="grid gap-4 md:grid-cols-[320px,1fr]">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Threads
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Driver</Label>
                  <Input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Search driver…" />
                </div>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-3">
              {filteredThreads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  No matching threads.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredThreads.map((t) => (
                    <ThreadListCard
                      key={t.id}
                      thread={t}
                      driverLabel={threadDriverLabel(t)}
                      active={t.id === activeThreadId}
                      onSelect={() => setActiveThreadId(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-[520px] flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-900",
              activeThreadId
                ? "border-teal-600 dark:border-teal-500"
                : "border-slate-200 dark:border-slate-700"
            )}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {activeThread ? activeThread.subject : "Select a thread"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeThread ? threadDriverLabel(activeThread) : ""}
                  {activeThread?.sheet ? ` • Sheet week of ${weekLabel(activeThread.sheet.week_starting)}` : ""}
                </p>
                {activeThread?.sheet ? (
                  <Link
                    href={`/sheets/${activeThread.sheet.id}`}
                    className="text-xs underline text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <span className="inline-flex items-center gap-1">
                      Open sheet <ExternalLink className="w-3 h-3" />
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-100/80 dark:bg-slate-950/50">
              {!activeThreadId ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">Choose a thread on the left.</div>
              ) : threadLoading ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">No messages yet.</div>
              ) : (
                messages.map((m) => {
                  const fromManager = m.sender.role === "manager";
                  const bubbleTitle = fromManager
                    ? "Manager"
                    : resolveDriverBubbleName(drivers, m.sender, null);
                  const bubbleFooter = fromManager
                    ? m.sender.name?.trim() || m.sender.email || ""
                    : m.sender.email || "";
                  return (
                    <MessageBubbleRow
                      key={m.id}
                      body={m.body}
                      createdAt={formatWhen(m.createdAt)}
                      bubbleTitle={bubbleTitle}
                      bubbleFooter={bubbleFooter}
                      fromManager={fromManager}
                      viewerIsManager
                    />
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 p-3">
              <div className="flex gap-2">
                <Input
                  value={compose}
                  onChange={(e) => setCompose(e.target.value)}
                  placeholder={activeThreadId ? "Type a reply…" : "Select a thread to reply…"}
                  disabled={!activeThreadId || postMutation.isPending}
                />
                <Button
                  className="gap-2"
                  disabled={!activeThreadId || compose.trim().length === 0 || postMutation.isPending}
                  onClick={() => postMutation.mutate(compose.trim())}
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>
              {postMutation.isError ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {postMutation.error instanceof Error ? postMutation.error.message : "Failed to send."}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

