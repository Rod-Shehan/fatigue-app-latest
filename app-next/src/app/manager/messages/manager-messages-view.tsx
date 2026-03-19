"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { resolveDriverBubbleName } from "@/lib/messaging-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, ExternalLink } from "lucide-react";
import { MessageBubbleRow } from "@/components/messaging/MessageBubbleRow";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function weekLabel(weekStarting: string) {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function ManagerMessagesView() {
  const queryClient = useQueryClient();
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/manager"
          backLabel="Manager dashboard"
          title="Messages"
          subtitle="Driver questions and sheet edit requests"
          icon={<MessageSquare className="w-5 h-5" />}
        />

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
            <div className="max-h-[70vh] overflow-auto">
              {filteredThreads.length === 0 ? (
                <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No matching threads.</div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredThreads.map((t) => {
                    const active = t.id === activeThreadId;
                    const last = t.lastMessage?.body ? t.lastMessage.body : "";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveThreadId(t.id)}
                        className={[
                          "w-full text-left p-3 transition",
                          active ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={["text-sm font-semibold", active ? "" : "text-slate-900 dark:text-slate-100"].join(" ")}>
                              {threadDriverLabel(t)}: {t.subject}
                            </p>
                            {t.sheet ? (
                              <p className={["text-xs mt-0.5", active ? "opacity-90" : "text-slate-500 dark:text-slate-400"].join(" ")}>
                                Sheet: week of {weekLabel(t.sheet.week_starting)}
                              </p>
                            ) : (
                              <p className={["text-xs mt-0.5", active ? "opacity-90" : "text-slate-500 dark:text-slate-400"].join(" ")}>
                                General
                              </p>
                            )}
                          </div>
                          <span className={["text-[10px] whitespace-nowrap", active ? "opacity-90" : "text-slate-400"].join(" ")}>
                            {formatWhen(t.updatedAt)}
                          </span>
                        </div>
                        {last ? (
                          <p className={["text-xs mt-2 line-clamp-2", active ? "opacity-90" : "text-slate-600 dark:text-slate-300"].join(" ")}>
                            {last}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col min-h-[520px]">
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

