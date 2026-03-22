"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { api, type FatigueSheet } from "@/lib/api";
import { resolveDriverBubbleName } from "@/lib/messaging-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, ExternalLink } from "lucide-react";
import { MessageBubbleRow } from "@/components/messaging/MessageBubbleRow";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function weekLabel(weekStarting: string) {
  return new Date(weekStarting + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Driver-only messaging UI (contact managers). Not used for manager inbox — see ManagerMessagesView.
 */
export function DriverMessagesView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [compose, setCompose] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<"training" | "edit">("training");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newSheetId, setNewSheetId] = useState<string>("");

  const { data: threadsData } = useQuery({
    queryKey: ["messages", "threads"],
    queryFn: () => api.messages.threads(),
    refetchInterval: 7000,
  });
  const threads = threadsData?.threads ?? [];

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets"],
    queryFn: () => api.sheets.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => api.drivers.list(),
  });

  const headerDriverName = useMemo(() => {
    const u = session?.user;
    if (!u?.email) return null;
    return resolveDriverBubbleName(
      drivers,
      { name: u.name ?? null, email: u.email ?? null },
      { name: u.name, email: u.email }
    );
  }, [drivers, session?.user]);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeThreadId) ?? null, [threads, activeThreadId]);

  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ["messages", "thread", activeThreadId],
    queryFn: () => api.messages.thread(activeThreadId),
    enabled: !!activeThreadId,
    refetchInterval: 5000,
  });
  const messages = threadData?.messages ?? [];

  const suggestedSubject = useMemo(() => {
    if (newKind === "training") return "Training question";
    return "Request sheet edit";
  }, [newKind]);

  const createThreadMutation = useMutation({
    mutationFn: () =>
      api.messages.createThread({
        subject: (newSubject.trim() || suggestedSubject).trim(),
        body: newBody.trim(),
        sheetId: newKind === "edit" ? (newSheetId || null) : null,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "threads"] });
      setNewOpen(false);
      setNewSubject("");
      setNewBody("");
      setNewSheetId("");
      setCompose("");
      setActiveThreadId(res.thread.id);
    },
  });

  const postMutation = useMutation({
    mutationFn: (body: string) => api.messages.postMessage(activeThreadId, { body }),
    onSuccess: () => {
      setCompose("");
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", activeThreadId] });
      queryClient.invalidateQueries({ queryKey: ["messages", "threads"] });
    },
  });

  const sheetOptions = useMemo(() => {
    const byWeek = new Map<string, FatigueSheet[]>();
    for (const s of sheets) {
      const arr = byWeek.get(s.week_starting) ?? [];
      arr.push(s);
      byWeek.set(s.week_starting, arr);
    }
    return [...byWeek.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, list]) => ({ week, list: list.sort((a, b) => a.id.localeCompare(b.id)) }));
  }, [sheets]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <PageHeader
          backHref="/sheets"
          backLabel="Your sheets"
          title="Messages"
          subtitle="Contact your manager — training, questions, or sheet edit requests"
          driverDisplayName={headerDriverName ?? undefined}
          icon={<MessageSquare className="w-5 h-5" />}
          actions={
            <Button className="gap-2" onClick={() => { setNewKind("training"); setNewSubject(""); setNewBody(""); setNewSheetId(""); setNewOpen(true); }}>
              <Plus className="w-4 h-4" />
              New message
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-[320px,1fr]">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Your conversations
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">With your manager</p>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {threads.length === 0 ? (
                <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
                  No messages yet. Tap <strong>New message</strong> to reach your manager.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {threads.map((t) => {
                    const active = t.id === activeThreadId;
                    const last = t.lastMessage?.body ? t.lastMessage.body : "";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveThreadId(t.id)}
                        className={[
                          "w-full text-left p-3 transition",
                          active
                            ? "bg-slate-900 text-white dark:bg-slate-800/90 dark:text-slate-100 dark:ring-1 dark:ring-inset dark:ring-cyan-700/35"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={["text-sm font-semibold", active ? "" : "text-slate-900 dark:text-slate-100"].join(" ")}>
                              {t.subject}
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
                  {activeThread ? activeThread.subject : "Select a conversation"}
                </p>
                {activeThread?.sheet ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sheet: week of {weekLabel(activeThread.sheet.week_starting)}
                    </p>
                    <Link href={`/sheets/${activeThread.sheet.id}`} className="text-xs underline text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      <span className="inline-flex items-center gap-1">
                        Open sheet <ExternalLink className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                ) : activeThread ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">General</p>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-100/80 dark:bg-slate-950/50">
              {!activeThreadId ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Choose a conversation on the left, or start a <strong>New message</strong>.
                </div>
              ) : threadLoading ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">No messages yet.</div>
              ) : (
                messages.map((m) => {
                  const fromManager = m.sender.role === "manager";
                  const bubbleTitle = fromManager
                    ? "Manager"
                    : resolveDriverBubbleName(drivers, m.sender, session?.user ?? null);
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
                      viewerIsManager={false}
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
                  placeholder={activeThreadId ? "Type a message…" : "Select a conversation to reply…"}
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

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New message to your manager</DialogTitle>
              <DialogDescription>
                Choose a type and write your message. Use “Request sheet edit” if something on a sheet needs correcting.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newKind === "training" ? "default" : "outline"}
                  onClick={() => setNewKind("training")}
                >
                  Training question
                </Button>
                <Button
                  type="button"
                  variant={newKind === "edit" ? "default" : "outline"}
                  onClick={() => setNewKind("edit")}
                >
                  Request sheet edit
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Subject
                </Label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder={suggestedSubject}
                />
              </div>

              {newKind === "edit" ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Related sheet (optional)
                  </Label>
                  <select
                    value={newSheetId}
                    onChange={(e) => setNewSheetId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No sheet selected</option>
                    {sheetOptions.map(({ week, list }) => (
                      <optgroup key={week} label={`Week of ${weekLabel(week)}`}>
                        {list.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.driver_name || "Driver"} — {s.status}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Message
                </Label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder={newKind === "training" ? "What do you need help with?" : "What was entered incorrectly and what should it be?"}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {createThreadMutation.isError ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {createThreadMutation.error instanceof Error ? createThreadMutation.error.message : "Failed to create thread."}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setNewOpen(false)} disabled={createThreadMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createThreadMutation.mutate()}
                  disabled={(newSubject.trim() || suggestedSubject).trim().length < 3 || newBody.trim().length === 0 || createThreadMutation.isPending}
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
