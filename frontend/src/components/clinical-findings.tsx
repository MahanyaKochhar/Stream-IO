"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import type { ClinicalRequirements, Finding } from "@/lib/referrals";

type Props = {
  clinical: ClinicalRequirements;
  canReview: boolean;
  isLoading: boolean;
  respond: (response: unknown) => Promise<void>;
  submissionError: string | null;
};

export function ClinicalFindings({
  clinical,
  canReview,
  isLoading,
  respond,
  submissionError,
}: Props) {
  const [draft, setDraft] = useState(clinical.findings);
  const [editing, setEditing] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const decision = clinical.decision;
  const findings = decision ? clinical.findings : draft;
  const disabled = !canReview || isLoading || submitting;
  const requirements = new Map(
    clinical.requirements.map((item) => [item.id, item]),
  );
  const documented = findings.filter(
    (item) => item.status === "documented",
  ).length;

  function editFinding(id: string, value: string) {
    setDraft((current) =>
      current.map(
        (finding): Finding =>
          finding.requirement_id === id
            ? {
                ...finding,
                value: value || null,
                status: value.trim() ? "documented" : "not_documented",
              }
            : finding,
      ),
    );
  }

  async function decide(value: "approve" | "reject") {
    if (disabled || submittingRef.current) return;
    if (!coordinator.trim()) {
      setError("Enter your name to record the coordinator decision.");
      nameRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await respond({
        decision: value,
        findings: draft,
        reviewed_by: coordinator.trim(),
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The decision could not be saved. Your edits are still here; please try again.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <section
        aria-labelledby="clinical-findings"
        className="mt-7 rounded-2xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2
            id="clinical-findings"
            tabIndex={-1}
            className="scroll-mt-28 text-base font-semibold text-slate-950"
          >
            Clinical findings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {decision
              ? "Reviewed findings"
              : "Review the extracted findings against the source PDF. Edit any value before deciding."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {documented} documented · {findings.length - documented} not
            documented
          </p>
        </div>
        <div className="divide-y divide-slate-100 px-5">
          {findings.map((finding, index) => {
            const label =
              requirements.get(finding.requirement_id)?.description ??
              finding.requirement_id.replaceAll(/[._]/g, " ");
            const changed =
              !decision && finding.value !== clinical.findings[index]?.value;
            return (
              <div className="py-4" key={finding.requirement_id}>
                <div className="flex items-start justify-between gap-3">
                  <label
                    className="text-sm font-medium leading-6 text-slate-800"
                    htmlFor={`finding-${index}`}
                  >
                    {label}
                  </label>
                  {!decision && (
                    <button
                      type="button"
                      aria-label={`Edit ${label}`}
                      disabled={disabled}
                      onClick={() => setEditing(finding.requirement_id)}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-stream-blue disabled:opacity-40"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>
                {editing === finding.requirement_id && !decision ? (
                  <textarea
                    id={`finding-${index}`}
                    autoFocus
                    disabled={disabled}
                    value={finding.value ?? ""}
                    onChange={(event) =>
                      editFinding(finding.requirement_id, event.target.value)
                    }
                    onBlur={() => setEditing(null)}
                    className="mt-2 field-sizing-content min-h-24 w-full rounded-lg border border-stream-blue bg-white p-3 text-sm leading-6 text-slate-700 outline-2 outline-offset-2 outline-stream-blue"
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {finding.value || "Not documented in the packet."}
                  </p>
                )}
                <p
                  className={`mt-2 text-xs ${finding.status === "documented" ? "text-slate-400" : "text-amber-700"}`}
                >
                  {changed
                    ? "Edited by you"
                    : finding.status === "documented"
                      ? "Documented"
                      : "Not documented"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer
        aria-label="Referral decision"
        className="sticky bottom-0 z-10 mt-5 border-t border-slate-200 bg-white/95 px-1 py-4 backdrop-blur-sm"
      >
        {decision ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3"
          >
            {decision === "approve" ? (
              <Check className="mt-0.5 size-5 text-stream-teal" />
            ) : (
              <X className="mt-0.5 size-5 text-slate-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {decision === "approve"
                  ? "Referral approved"
                  : "Referral rejected"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {clinical.reviewed_by ?? "Coordinator not recorded"} ·{" "}
                {clinical.reviewed_at
                  ? new Date(clinical.reviewed_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Timestamp not recorded"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label
                  className="mb-1 block text-xs font-medium text-slate-600"
                  htmlFor="coordinator-name"
                >
                  Coordinator name
                </label>
                <input
                  ref={nameRef}
                  id="coordinator-name"
                  autoComplete="name"
                  maxLength={120}
                  value={coordinator}
                  onChange={(event) => setCoordinator(event.target.value)}
                  disabled={disabled}
                  placeholder="Your name"
                  aria-describedby={error ? "review-error" : undefined}
                  className="h-10 w-full min-w-32 max-w-64 rounded-lg border border-slate-200 px-3 text-sm outline-stream-blue disabled:bg-slate-50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void decide("reject")}
                  disabled={disabled}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                >
                  Reject referral
                </button>
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={disabled}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-stream-navy px-4 text-sm font-medium text-white hover:bg-stream-teal disabled:opacity-40"
                >
                  {submitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{" "}
                  Approve and continue
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Approval saves your edits and completes intake. Rejection saves
              your edits and closes this referral as rejected.
            </p>
            {(error || submissionError) && (
              <p
                id="review-error"
                role="alert"
                className="mt-2 text-sm text-rose-700"
              >
                {error || submissionError}
              </p>
            )}
          </>
        )}
      </footer>
    </>
  );
}
