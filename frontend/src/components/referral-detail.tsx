"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useStream } from "@langchain/react";
import { ClinicalFindings } from "@/components/clinical-findings";
import { ReferralConversation } from "@/components/referral-chat";
import { SourcePdf } from "@/components/source-pdf";
import { respondToReview, useReferralState } from "@/lib/use-referral-state";
import {
  ArrowLeft,
  FileText,
  PanelRight,
  Maximize2,
  Minimize2,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  AGENT_SERVER_URL,
  ASSISTANT_ID,
  type ReviewInterrupt,
  patientName,
  fileName,
  formatBirthDate,
} from "@/lib/referrals";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-800">
        {value || "—"}
      </dd>
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
  const [sourceOpen, setSourceOpen] = useState(true);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const stream = useStream<Record<string, unknown>, ReviewInterrupt>({
    apiUrl: AGENT_SERVER_URL,
    assistantId: ASSISTANT_ID,
    threadId,
    optimistic: false,
  });
  const state = useReferralState(stream);
  const error =
    stream.error instanceof Error
      ? stream.error.message
      : stream.error
        ? "Referral record could not be loaded."
        : !stream.isThreadLoading && !state.pdf_path
          ? "This referral's saved state is unavailable. Return to the workspace and upload the packet again."
          : null;

  if (error && !state.pdf_path) {
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

  if (stream.isThreadLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 animate-pulse px-5 py-10 md:px-8">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-8 h-10 w-72 rounded bg-slate-200" />
        <div className="mt-8 h-52 rounded-2xl bg-slate-100" />
      </main>
    );
  }

  const extracted = state.extracted;
  const clinical = state.clinical_requirements;
  const storedName = fileName(state.pdf_path);
  const pdfName =
    state.pdf_name ??
    (/^[0-9a-f-]{36}\.pdf$/i.test(storedName)
      ? "Referral packet.pdf"
      : storedName || "Referral packet.pdf");
  const reviewPending = stream.interrupt?.value?.type === "clinical_review";
  const missingReviewCheckpoint = Boolean(
    clinical && !clinical.decision && !reviewPending,
  );
  const patient = state.patient ?? extracted?.patient;
  const insurance = state.insurance ?? extracted?.insurance;
  const dob = formatBirthDate(patient?.date_of_birth);

  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-8 sm:px-5 md:px-8">
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold capitalize text-teal-700">
            {reviewPending
              ? "Review required"
              : (state.outcome?.replaceAll("_", " ") ?? "In progress")}
          </span>
          <span className="break-all text-xs text-slate-400">
            {threadId}
          </span>
        </div>
      </div>

      <div
        className={`mt-6 grid items-start gap-3 sm:gap-6 ${sourceOpen ? (sourceExpanded ? "grid-cols-[minmax(0,42%)_minmax(0,1fr)] sm:grid-cols-[minmax(280px,42%)_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,44%)] sm:grid-cols-[minmax(0,1fr)_minmax(280px,44%)]") : "grid-cols-[minmax(0,1fr)_minmax(0,44%)] sm:grid-cols-[minmax(0,1fr)_280px]"}`}
      >
        <div className="@container min-w-0">
          <section aria-label="Referral packet review">
            <div className="grid gap-5 @xl:grid-cols-2">
              <Section icon={<UserRound className="size-4" />} title="Patient">
                <dl className="grid gap-5 @xl:grid-cols-2">
                  <Field label="First name" value={patient?.first_name} />
                  <Field label="Last name" value={patient?.last_name} />
                  <Field label="Date of birth" value={dob} />
                  <Field label="Sex" value={patient?.sex} />
                  <Field label="Phone" value={patient?.phone} />
                </dl>
              </Section>

              <Section
                icon={<ShieldCheck className="size-4" />}
                title="Insurance"
              >
                <dl className="grid gap-5 @xl:grid-cols-2">
                  <Field label="Payer" value={insurance?.payer_name} />
                  <Field label="Member ID" value={insurance?.member_id} />
                  <Field label="Group number" value={insurance?.group_number} />
                </dl>
              </Section>
            </div>
            <div className="mt-5">
              <Section icon={<FileText className="size-4" />} title="Referral">
                <dl className="grid gap-5 @xl:grid-cols-2">
                  <Field label="Specialty" value={extracted?.specialty} />
                  <Field label="Subspecialty" value={extracted?.subspecialty} />
                  <Field label="Service" value={extracted?.service} />
                  <Field label="Condition" value={extracted?.condition} />
                  <Field label="Priority" value={extracted?.priority} />
                  <Field
                    label="Referral type"
                    value={extracted?.referral_type}
                  />
                </dl>
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <h3 className="mb-4 text-sm font-semibold text-slate-700">
                    Referring provider
                  </h3>
                  <dl className="grid gap-5 @xl:grid-cols-2">
                    <Field label="Name" value={extracted?.referring_provider?.name} />
                    <Field label="NPI" value={extracted?.referring_provider?.npi} />
                    <Field label="Organization" value={extracted?.referring_provider?.organization} />
                  </dl>
                </div>
              </Section>
            </div>
            {clinical ? (
              <ClinicalFindings
                clinical={clinical}
                canReview={reviewPending}
                isLoading={stream.isLoading}
                respond={(response) => respondToReview(stream, response)}
                submissionError={
                  error ??
                  (missingReviewCheckpoint
                    ? "This referral has no active review checkpoint. Start a new chat and process the PDF again."
                    : null)
                }
              />
            ) : (
              <p className="my-6 text-sm text-slate-500">
                {state.outcome === "needs_information"
                  ? "Clinical review has not started because required referral information is missing."
                  : "Clinical findings will appear when extraction is complete."}
              </p>
            )}
          </section>
          <section
            aria-label="Referral conversation"
            className="mx-auto mt-9 w-full max-w-[560px] pb-8"
          >
            <ReferralConversation stream={stream} embedded />
          </section>
        </div>
        <aside
          aria-label="Sources"
          className={`sticky top-5 flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${sourceOpen ? "h-[calc(100vh-3rem)]" : ""}`}
        >
          <div className="shrink-0 border-b border-slate-100 px-3 py-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xs font-normal text-slate-400">Sources</h2>
              {sourceOpen && (
                <button
                  type="button"
                  onClick={() => setSourceExpanded((value) => !value)}
                  aria-label={
                    sourceExpanded ? "Reduce source PDF" : "Expand source PDF"
                  }
                  title={
                    sourceExpanded ? "Reduce source PDF" : "Expand source PDF"
                  }
                  className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-stream-blue sm:block"
                >
                  {sourceExpanded ? (
                    <Minimize2 className="size-3.5" />
                  ) : (
                    <Maximize2 className="size-3.5" />
                  )}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label={`Toggle source PDF: ${pdfName}`}
              aria-expanded={sourceOpen}
              aria-controls="source-pdf"
              title={pdfName}
              onClick={() => {
                setSourceOpen((value) => !value);
                setSourceExpanded(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-stream-blue"
            >
              <FileText className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 truncate">{pdfName}</span>
              <PanelRight
                className={`ml-auto size-4 shrink-0 ${sourceOpen ? "text-stream-navy" : "text-slate-400"}`}
              />
            </button>
          </div>
          {sourceOpen && <SourcePdf threadId={threadId} />}
        </aside>
      </div>
    </main>
  );
}
