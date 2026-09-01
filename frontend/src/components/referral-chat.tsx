"use client";

import { useEffect, useMemo, useState } from "react";
import { useStream } from "@langchain/react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import type { FileUIPart } from "ai";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  useProviderAttachments,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Suggestion,
  Suggestions,
} from "@/components/ai-elements/suggestion";
import {
  AGENT_SERVER_URL,
  ASSISTANT_ID,
  type Finding,
  type ReferralState,
  type Requirement,
  type ReviewInterrupt,
} from "@/lib/referrals";

type SubmittedFile = {
  filename: string;
  size: number;
};

type ReferralChatProps = {
  onNewReferral: () => void;
  onReferralChange: () => void;
};

type UploadPhase = "uploading" | "processing" | null;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PendingFile({
  file,
  onRemove,
  phase,
}: {
  file: FileUIPart & { id: string };
  onRemove: () => void;
  phase: UploadPhase;
}) {
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(file.url)
      .then((response) => response.blob())
      .then((blob) => {
        if (active) setSize(blob.size);
      });
    return () => {
      active = false;
    };
  }, [file.url]);

  return (
    <Attachment
      className="overflow-hidden rounded-xl border-slate-200 bg-white p-2.5 shadow-sm hover:bg-white"
      data={file}
      onRemove={onRemove}
    >
      <AttachmentPreview
        className="size-10 rounded-lg bg-rose-50 text-stream-coral"
        fallbackIcon={<FileText className="size-5" />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">
          {file.filename ?? "referral.pdf"}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {phase === "uploading"
            ? "Uploading…"
            : phase === "processing"
              ? "Processing…"
              : `${size ? formatFileSize(size) : "PDF"} · PDF`}
        </p>
      </div>
      {phase ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin text-stream-blue" />
      ) : (
        <AttachmentRemove className="size-7" />
      )}
    </Attachment>
  );
}

function PendingAttachments({ phase }: { phase: UploadPhase }) {
  const attachments = usePromptInputAttachments();

  if (!attachments.files.length) return null;

  return (
    <PromptInputHeader>
      <Attachments className="w-full" variant="list">
        {attachments.files.map((file) => (
          <PendingFile
            file={file}
            key={file.id}
            onRemove={() => attachments.remove(file.id)}
            phase={phase}
          />
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function UploadSuggestion({ disabled }: { disabled: boolean }) {
  const attachments = useProviderAttachments();

  if (disabled || attachments.files.length) return null;

  return (
    <Suggestions className="mt-3 flex-col items-stretch gap-1">
      <Suggestion
        className="h-auto w-full justify-start gap-3 rounded-xl border-transparent bg-transparent px-2 py-2 text-left shadow-none hover:border-transparent hover:bg-slate-50"
        onClick={attachments.openFileDialog}
        suggestion="Start a new referral intake"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-stream-mist text-stream-teal">
          <Paperclip className="size-3.5" />
        </span>
        <span className="min-w-0 text-xs font-semibold text-slate-700">
          Start a new referral intake
        </span>
      </Suggestion>
    </Suggestions>
  );
}

function AddFileButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputButton
      aria-label="Attach PDF"
      disabled={disabled}
      onClick={attachments.openFileDialog}
      type="button"
    >
      <Paperclip className="size-4" />
    </PromptInputButton>
  );
}

function ProgressMessage({
  state,
  reviewReady,
}: {
  state: ReferralState;
  reviewReady: boolean;
}) {
  const steps = [
    {
      label: "Reading referral packet",
      description: "Organizing the uploaded clinical documents",
      done: Boolean(state.markdown),
    },
    {
      label: "Checking intake details",
      description: "Reviewing patient, insurance, and referral information",
      done: Boolean(state.patient && state.insurance),
    },
    {
      label: "Preparing clinical review",
      description: "Summarizing relevant requirements and findings",
      done: reviewReady || Boolean(state.clinical_requirements || state.outcome),
    },
  ];
  const completeCount = steps.filter((step) => step.done).length;
  const activeIndex = steps.findIndex((step) => !step.done);
  const progress = Math.round((completeCount / steps.length) * 100);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-stream-mist text-stream-teal">
              {reviewReady ? (
                <Check className="size-4" />
              ) : (
                <LoaderCircle className="size-4 animate-spin" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-stream-navy">
                {reviewReady ? "Processing complete" : "Processing referral"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {reviewReady
                  ? "Ready for clinical review"
                  : "Reviewing the packet and preparing it for intake"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-stream-teal">
            {progress}%
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-stream-teal transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-0 px-4 py-2">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <div className="flex gap-3 py-2.5" key={step.label}>
              <span
                className={
                  step.done
                    ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-50 text-stream-teal"
                    : isActive
                      ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sky-50 text-stream-blue"
                      : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-300"
                }
              >
                {step.done ? (
                  <Check className="size-3" />
                ) : isActive ? (
                  <LoaderCircle className="size-3 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-xs font-medium ${
                    step.done || isActive ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function requirementLabel(id: string): string {
  const label = id.split(".").at(-1) ?? id;
  return label
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FindingRow({
  finding,
  requirement,
}: {
  finding: Finding;
  requirement?: Requirement;
}) {
  const documented = finding.status === "documented";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-5 text-slate-700">
            {requirement?.description ?? requirementLabel(finding.requirement_id)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {finding.value || "No supporting information found in the packet."}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
            documented
              ? "bg-teal-50 text-teal-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {documented ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <AlertCircle className="size-3" />
          )}
          {documented ? "Documented" : "Missing"}
        </span>
      </div>
    </div>
  );
}

function ReviewCard({
  interrupt,
  isLoading,
  onReview,
}: {
  interrupt: ReviewInterrupt;
  isLoading: boolean;
  onReview: (decision: "approve" | "reject") => void;
}) {
  const requirements = new Map(
    interrupt.requirements?.map((requirement) => [requirement.id, requirement])
  );
  const documentedCount = interrupt.findings.filter(
    (finding) => finding.status === "documented"
  ).length;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stream-navy">
              Clinical review required
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {interrupt.instruction}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700">
            {documentedCount} documented
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            {interrupt.findings.length - documentedCount} missing
          </span>
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
        {interrupt.findings.map((finding) => (
          <FindingRow
            finding={finding}
            key={finding.requirement_id}
            requirement={requirements.get(finding.requirement_id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/60 p-3">
        <button
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          disabled={isLoading}
          onClick={() => onReview("reject")}
          type="button"
        >
          Reject packet
        </button>
        <button
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-stream-navy px-3 text-xs font-semibold text-white transition hover:bg-[#0b1d36] disabled:opacity-50"
          disabled={isLoading}
          onClick={() => onReview("approve")}
          type="button"
        >
          <Check className="size-3.5" /> Approve
        </button>
      </div>
    </div>
  );
}

function ReferralChatPanel({
  onNewReferral,
  onReferralChange,
}: ReferralChatProps) {
  const [submittedFile, setSubmittedFile] = useState<SubmittedFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);

  const stream = useStream<ReferralState, ReviewInterrupt>({
    apiUrl: AGENT_SERVER_URL,
    assistantId: ASSISTANT_ID,
    onCompleted: onReferralChange,
    onThreadId: onReferralChange,
    optimistic: false,
  });

  const interrupt = stream.interrupt?.value;
  const errorMessage = useMemo(() => {
    if (uploadError) return uploadError;
    if (!stream.error) return null;
    return stream.error instanceof Error
      ? stream.error.message
      : "The agent run could not be completed.";
  }, [stream.error, uploadError]);

  async function uploadFile(
    part: FileUIPart
  ): Promise<SubmittedFile & { path: string }> {
    const blob = await fetch(part.url).then((response) => response.blob());
    const file = new File([blob], part.filename ?? "referral.pdf", {
      type: part.mediaType,
    });
    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as {
      path?: string;
      filename?: string;
      size?: number;
      error?: string;
    };

    if (!response.ok || !result.path || !result.filename) {
      throw new Error(result.error ?? "Upload failed.");
    }

    return {
      path: result.path,
      filename: result.filename,
      size: result.size ?? file.size,
    };
  }

  async function handleSubmit(message: PromptInputMessage) {
    setUploadError(null);
    const part = message.files[0];

    if (!part) {
      setUploadError("Attach one referral packet in PDF format.");
      return;
    }

    setUploadPhase("uploading");
    try {
      const uploaded = await uploadFile(part);
      setSubmittedFile(uploaded);
      setUploadPhase("processing");
      await stream.submit({ pdf_path: uploaded.path });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      throw error;
    } finally {
      setUploadPhase(null);
    }
  }

  async function review(decision: "approve" | "reject") {
    setUploadError(null);
    await stream.respond(decision);
  }

  const isWorking = Boolean(uploadPhase) || stream.isLoading;
  const isComplete =
    stream.values.outcome === "referral_approved" ||
    stream.values.outcome === "referral_rejected" ||
    stream.values.outcome === "needs_information";
  const hasConversation = Boolean(
    submittedFile ||
      stream.values.pdf_path ||
      interrupt ||
      stream.values.outcome ||
      errorMessage
  );

  const composer = (
    <>
      <PromptInput
        accept="application/pdf"
        className="[&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-slate-200 [&_[data-slot=input-group]]:bg-white [&_[data-slot=input-group]]:shadow-sm"
        maxFileSize={15 * 1024 * 1024}
        maxFiles={1}
        multiple={false}
        onError={(error) => setUploadError(error.message)}
        onSubmit={handleSubmit}
      >
        <PendingAttachments phase={uploadPhase} />
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-11 py-3"
            disabled={isWorking || isComplete}
            placeholder="Add a note or attach a referral PDF…"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <AddFileButton disabled={isWorking || isComplete} />
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              PDF · up to 15 MB
            </span>
          </PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-full bg-stream-blue text-white hover:bg-stream-teal disabled:bg-slate-200 disabled:text-slate-400"
            disabled={isWorking || isComplete}
            onStop={() => void stream.stop()}
            status={isWorking ? "streaming" : errorMessage ? "error" : "ready"}
          >
            {!isWorking && !errorMessage ? (
              <ArrowUp className="size-4" />
            ) : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>

      {!hasConversation && (
        <UploadSuggestion disabled={isWorking || isComplete} />
      )}
    </>
  );

  return (
    <aside className="flex min-h-[610px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-35px_rgba(16,39,72,0.28)] lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
      {!hasConversation ? (
        <div className="flex flex-1 items-center justify-center bg-[#fbfcfc] px-4 py-10">
          <div className="w-full max-w-[640px] -translate-y-8">
            {composer}
          </div>
        </div>
      ) : (
        <>
          <Conversation className="min-h-0 flex-1 bg-[#fbfcfc]">
            <ConversationContent className="mx-auto w-full max-w-[640px] gap-4 p-4">
              {submittedFile && (
                <Message from="user">
                  <MessageContent className="border border-slate-200 bg-white px-3 py-2.5 text-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-stream-coral">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {submittedFile.filename}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(submittedFile.size)} · PDF
                        </p>
                      </div>
                    </div>
                  </MessageContent>
                </Message>
              )}

              {(submittedFile || stream.values.pdf_path) && (
                <Message from="assistant">
                  <MessageContent className="w-full">
                    <ProgressMessage
                      reviewReady={Boolean(interrupt || stream.values.outcome)}
                      state={stream.values}
                    />
                  </MessageContent>
                </Message>
              )}

              {interrupt && (
                <Message from="assistant">
                  <MessageContent className="w-full">
                    <ReviewCard
                      interrupt={interrupt}
                      isLoading={stream.isLoading}
                      onReview={(decision) => void review(decision)}
                    />
                  </MessageContent>
                </Message>
              )}

              {stream.values.outcome && !interrupt && !stream.isLoading && (
                <Message from="assistant">
                  <MessageContent className="border border-teal-200 bg-teal-50/70 text-slate-800 shadow-sm">
                    <p className="text-sm font-semibold text-slate-950">
                      Intake complete
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      The referral record has been updated and is ready in the
                      workspace.
                    </p>
                    {isComplete && (
                      <button
                        className="mt-3 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50"
                        onClick={onNewReferral}
                        type="button"
                      >
                        Start another referral
                      </button>
                    )}
                  </MessageContent>
                </Message>
              )}

              {errorMessage && (
                <Message from="assistant">
                  <MessageContent className="border border-rose-200 bg-rose-50 text-sm text-rose-700">
                    {errorMessage}
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-slate-100 bg-white p-4">
            <div className="mx-auto w-full max-w-[640px]">{composer}</div>
          </div>
        </>
      )}
    </aside>
  );
}

export function ReferralChat(props: ReferralChatProps) {
  return (
    <PromptInputProvider>
      <ReferralChatPanel {...props} />
    </PromptInputProvider>
  );
}
