"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileText, ShieldCheck, UserRound } from "lucide-react";

import {
  AGENT_SERVER_URL,
  type ReferralState,
  patientName,
} from "@/lib/referrals";

type StateResponse = {
  values: ReferralState | null;
  created_at?: string;
  updated_at?: string;
  next?: string[];
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-stream-mist text-stream-navy">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function ReferralDetail({ threadId }: { threadId: string }) {
  const [snapshot, setSnapshot] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${AGENT_SERVER_URL}/threads/${threadId}/state`);
        if (!response.ok) throw new Error("Referral record could not be loaded.");
        setSnapshot((await response.json()) as StateResponse);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load referral."
        );
      }
    }

    void load();
  }, [threadId]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:px-8">
        <Link className="text-sm font-medium text-stream-teal" href="/">
          ← Back to referrals
        </Link>
        <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 animate-pulse px-5 py-10 md:px-8">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-8 h-10 w-72 rounded bg-slate-200" />
        <div className="mt-8 h-52 rounded-2xl bg-slate-100" />
      </main>
    );
  }

  const state = snapshot.values ?? {};
  const extracted = state.extracted;
  const clinical = state.clinical_requirements;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
        href="/"
      >
        <ArrowLeft className="size-4" /> Referral overview
      </Link>

      <div className="mt-7 flex flex-col justify-between gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stream-teal">
            Referral record
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            {patientName(state)}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {extracted?.reason_for_referral ?? "Referral packet details"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold capitalize text-teal-700">
            {state.outcome?.replaceAll("_", " ") ?? "In progress"}
          </span>
          <span className="text-xs text-slate-400">
            Record {threadId.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section icon={<UserRound className="size-4" />} title="Patient">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" value={state.patient?.first_name} />
            <Field label="Last name" value={state.patient?.last_name} />
            <Field label="Date of birth" value={state.patient?.date_of_birth} />
            <Field label="Sex" value={state.patient?.sex} />
            <Field label="Phone" value={state.patient?.phone} />
          </dl>
        </Section>

        <Section icon={<ShieldCheck className="size-4" />} title="Insurance">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label="Payer" value={state.insurance?.payer_name} />
            <Field label="Member ID" value={state.insurance?.member_id} />
            <Field label="Group number" value={state.insurance?.group_number} />
          </dl>
        </Section>

        <Section icon={<FileText className="size-4" />} title="Referral">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label="Specialty" value={extracted?.specialty} />
            <Field label="Subspecialty" value={extracted?.subspecialty} />
            <Field label="Service" value={extracted?.service} />
            <Field label="Condition" value={extracted?.condition} />
            <Field label="Priority" value={extracted?.priority} />
            <Field label="Referral type" value={extracted?.referral_type} />
          </dl>
        </Section>

        <Section icon={<Check className="size-4" />} title="Clinical requirements">
          {clinical?.findings.length ? (
            <div className="space-y-3">
              {clinical.findings.map((finding) => (
                <div
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3"
                  key={finding.requirement_id}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold capitalize text-slate-700">
                      {finding.requirement_id.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {finding.value || "No value documented"}
                    </p>
                  </div>
                  <span
                    className={
                      finding.status === "documented"
                        ? "shrink-0 rounded-full bg-teal-100 px-2 py-1 text-[10px] font-semibold capitalize text-teal-700"
                        : "shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold capitalize text-amber-700"
                    }
                  >
                    {finding.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Clinical findings will appear after the intake graph reaches review.
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}
