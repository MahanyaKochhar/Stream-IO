"use client";

import { type ComponentType, useState } from "react";
import Link from "next/link";
import type { UIMessage } from "@langchain/langgraph-sdk/react-ui";
import {
  AlertCircle,
  ArrowUpRight,
  ClipboardCheck,
  Clock3,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Message, MessageContent } from "@/components/ai-elements/message";
import type {
  CoordinatorWorkflow,
  Finding,
  Requirement,
} from "@/lib/referrals";

type UIActions = {
  canRespond: boolean;
  isLoading: boolean;
  respond: (response: unknown) => Promise<void>;
  reviewHref?: string;
};

type RegistryComponentProps = UIActions & {
  message: UIMessage;
};

type ProgressProps = {
  workflow: CoordinatorWorkflow;
};

type ClinicalReviewProps = {
  instruction: string;
  findings: Finding[];
  requirements: Requirement[];
  editable: boolean;
  decision?: "approve" | "reject" | null;
};

type RoutingReviewProps = {
  instruction: string;
  reason: string;
  editable: boolean;
  review_text?: string;
};

function ReferralProgress({ message, isLoading }: RegistryComponentProps) {
  const { workflow } = message.props as ProgressProps;
  const steps = Object.values(workflow).sort((a, b) => a.order - b.order);
  const completeCount = steps.filter(
    (step) => step.status === "complete",
  ).length;
  const needsAttention = steps.some((step) => step.status === "attention");

  return (
    <ChainOfThought
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      key={String(isLoading)}
      defaultOpen={isLoading}
    >
      <ChainOfThoughtHeader className="font-semibold text-stream-navy hover:text-stream-navy">
        <span className="flex items-center justify-between gap-3">
          <span>
            {needsAttention
              ? "Referral needs attention"
              : isLoading
                ? "Processing referral"
                : "Referral prepared"}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {completeCount} of {steps.length}
          </span>
        </span>
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {steps.map((step) => {
          const active = step.status === "active";
          const attention = step.status === "attention";
          return (
            <ChainOfThoughtStep
              className={
                active && isLoading
                  ? "[&>div:first-child>svg]:animate-spin [&>div:first-child]:text-stream-blue"
                  : attention
                    ? "[&>div:first-child]:text-amber-600"
                    : "[&>div:first-child]:text-stream-teal"
              }
              description={step.description}
              icon={
                active
                  ? isLoading
                    ? LoaderCircle
                    : Clock3
                  : attention
                    ? AlertCircle
                    : CheckCircle2
              }
              key={step.id}
              label={step.title}
              status={active || attention ? "active" : "complete"}
            />
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function ClinicalReview({ message, reviewHref }: RegistryComponentProps) {
  const { findings, decision } = message.props as ClinicalReviewProps;

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100">
        <ClipboardCheck className="size-4 text-slate-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {decision
            ? "Clinical findings reviewed"
            : `${findings.length} clinical findings extracted`}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          {decision ? "View saved decision" : "Review findings"}
          <ArrowUpRight className="size-3" />
        </p>
      </div>
      {reviewHref && (
        <Link
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stream-blue"
          href={reviewHref}
        >
          {decision ? "View" : "Review"}
        </Link>
      )}
    </div>
  );
}

function RoutingReview({
  message,
  canRespond,
  isLoading,
  respond,
}: RegistryComponentProps) {
  const props = message.props as RoutingReviewProps;
  const [note, setNote] = useState(props.review_text ?? "");

  return (
    <div className="w-full rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-stream-navy">Routing review</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{props.reason}</p>
      <textarea
        className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-stream-blue disabled:bg-slate-50"
        disabled={!props.editable || isLoading}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Enter coordinator review notes…"
        value={note}
      />
      {props.editable && (
        <button
          className="mt-2 h-9 rounded-xl bg-stream-navy px-4 text-xs font-semibold text-white disabled:opacity-50"
          disabled={!canRespond || isLoading || !note.trim()}
          onClick={() => void respond(note.trim())}
          type="button"
        >
          Submit review
        </button>
      )}
    </div>
  );
}

export const REFERRAL_UI_COMPONENTS: Record<
  string,
  ComponentType<RegistryComponentProps>
> = {
  referral_progress: ReferralProgress,
  clinical_review: ClinicalReview,
  routing_review: RoutingReview,
};

export function ReferralUIMessage({
  message,
  ...actions
}: RegistryComponentProps) {
  const Component = REFERRAL_UI_COMPONENTS[message.name];
  if (!Component) return null;

  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        <Component message={message} {...actions} />
      </MessageContent>
    </Message>
  );
}
