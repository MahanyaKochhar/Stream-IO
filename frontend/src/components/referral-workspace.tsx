"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { ReferralChat } from "@/components/referral-chat";
import {
  AGENT_SERVER_URL,
  type ReferralThread,
  formatDate,
  patientName,
  statusLabel,
} from "@/lib/referrals";

function StatusPill({ thread }: { thread: ReferralThread }) {
  const label = statusLabel(thread);
  const style =
    thread.status === "busy"
      ? "bg-sky-50 text-sky-700"
      : thread.status === "interrupted"
        ? "bg-orange-50 text-[#d64f3c]"
        : thread.status === "error"
          ? "bg-rose-50 text-rose-700"
          : thread.values?.outcome === "referral_rejected"
            ? "bg-slate-100 text-slate-600"
            : "bg-teal-50 text-teal-700";

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}
      >
        {label}
      </span>
      {thread.status === "idle" && thread.values?.outcome === "needs_information" && (
        <span className="text-[10px] font-normal text-amber-700">
          (Needs information)
        </span>
      )}
    </span>
  );
}

function ReferralRows({ threads }: { threads: ReferralThread[] }) {
  if (!threads.length) {
    return (
      <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
        <div>
          <FileCheck2 className="mx-auto mb-2 size-5 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">No referrals here yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Upload a packet in the intake panel to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {threads.map((thread, index) => (
        <Link
          className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-white px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1.4fr)_minmax(130px,.8fr)_110px_24px] ${index ? "border-t border-slate-100" : ""}`}
          href={`/referrals/${thread.thread_id}`}
          key={thread.thread_id}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {patientName(thread.values)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {thread.values?.extracted?.reason_for_referral ??
                thread.values?.extracted?.referral_type ??
                "Referral intake"}
            </p>
            <p className="mt-1.5 break-all text-[10px] leading-4 text-slate-400">
              {thread.thread_id}
            </p>
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-xs font-medium text-slate-700">
              {thread.values?.extracted?.subspecialty ??
                thread.values?.extracted?.specialty ??
                "Awaiting classification"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Updated {formatDate(thread.updated_at)}
            </p>
          </div>
          <StatusPill thread={thread} />
          <ArrowUpRight className="hidden size-4 text-slate-300 transition group-hover:text-slate-700 sm:block" />
        </Link>
      ))}
    </div>
  );
}

type QueueView = "processing" | "completed" | "review";

const queueDetails: Record<
  QueueView,
  { label: string; description: string; icon: typeof Clock3 }
> = {
  processing: {
    label: "Processing",
    description: "Packets currently being processed",
    icon: Clock3,
  },
  completed: {
    label: "Completed",
    description: "Reviewed and closed intake records",
    icon: CheckCircle2,
  },
  review: {
    label: "Review",
    description: "Packets awaiting a clinical decision",
    icon: ShieldCheck,
  },
};

export function ReferralWorkspace() {
  const [threads, setThreads] = useState<ReferralThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueView, setQueueView] = useState<QueueView>("processing");

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch(`${AGENT_SERVER_URL}/threads/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 50,
          sort_by: "updated_at",
          sort_order: "desc",
          select: [
            "thread_id",
            "created_at",
            "updated_at",
            "status",
            "values",
            "interrupts",
          ],
        }),
      });

      if (!response.ok) throw new Error("Agent Server is unavailable.");
      setThreads((await response.json()) as ReferralThread[]);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load referrals."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadThreads(), 0);
    const timer = window.setInterval(() => void loadThreads(), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadThreads]);

  const queues = useMemo(() => {
    const result: Record<QueueView, ReferralThread[]> = {
      processing: [],
      completed: [],
      review: [],
    };
    for (const thread of threads) {
      if (thread.status === "interrupted") result.review.push(thread);
      else if (thread.status === "idle" && thread.values)
        result.completed.push(thread);
      else result.processing.push(thread);
    }
    return result;
  }, [threads]);
  const selectedQueue = queues[queueView];
  const selectedDetails = queueDetails[queueView];

  return (
    <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-6 px-4 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_410px]">
      <section className="grid min-w-0 gap-6 xl:grid-cols-[190px_minmax(0,1fr)]">
        <nav
          aria-label="Referral queues"
          className="flex min-w-0 items-center xl:sticky xl:top-24 xl:h-[calc(100vh-12rem)] xl:self-start"
        >
          <div className="grid w-full grid-cols-3 gap-2 xl:grid-cols-1 xl:gap-1">
            {(Object.keys(queueDetails) as QueueView[]).map((view) => {
              const details = queueDetails[view];
              const Icon = details.icon;
              const selected = queueView === view;

              return (
                <button
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left transition xl:w-full ${
                    selected
                      ? "bg-stream-navy text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-stream-navy"
                  }`}
                  key={view}
                  onClick={() => setQueueView(view)}
                  type="button"
                >
                  <Icon
                    className={`size-4 shrink-0 ${selected ? "text-stream-aqua" : "text-slate-400"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">
                    {details.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      selected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {queues[view].length}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stream-teal">
                Intake workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
                {selectedDetails.label}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {selectedDetails.description}
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 sm:self-auto"
              onClick={() => void loadThreads()}
              type="button"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error} Start the LangGraph server at {AGENT_SERVER_URL}.
            </div>
          )}

          <div className="space-y-3 pb-4">
            <ReferralRows threads={selectedQueue} />
          </div>
        </div>
      </section>

      <ReferralChat onReferralChange={() => void loadThreads()} />
    </main>
  );
}
