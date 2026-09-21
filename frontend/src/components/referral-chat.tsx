"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useStream } from "@langchain/react";
import { isAIMessage } from "@langchain/core/messages";
import type { Message as StoredMessage } from "@langchain/langgraph-sdk";
import { ArrowUp, FileText, LoaderCircle, Paperclip, Plus } from "lucide-react";
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
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
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
  usePromptInputController,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ReferralUIMessage } from "@/components/referral-ui";
import {
  respondToReview,
  useReferralState,
  type ReferralStream,
} from "@/lib/use-referral-state";
import {
  AGENT_SERVER_URL,
  ASSISTANT_ID,
  referralMessage,
  type ReferralState,
  type ReviewInterrupt,
} from "@/lib/referrals";

type ReferralChatProps = { onReferralChange: () => void };
type ChatSessionProps = ReferralChatProps & {
  threadId: string | null;
  onReset: (threadId: string | null) => void;
};
type ConversationProps = {
  stream: ReferralStream;
  embedded?: boolean;
  onNewChat?: () => void;
};
type UploadPhase = "uploading" | "sending" | null;

const INTAKE_REQUEST = "Process the attached pdf for patient intake";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getDisplayError(localError: string | null, runError: unknown) {
  if (localError) return localError;
  if (!runError) return null;
  return getErrorMessage(runError, "The agent run could not be completed.");
}

async function uploadFile(part: FileUIPart): Promise<{
  path: string;
  filename: string;
}> {
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
    error?: string;
  };
  if (!response.ok || !result.path || !result.filename) {
    throw new Error(result.error ?? "Upload failed.");
  }
  return {
    path: result.path,
    filename: result.filename,
  };
}

async function ensureReferralThread(stream: ReferralStream): Promise<string> {
  const metadata = { has_referral: true };
  if (!stream.threadId) {
    return (await stream.client.threads.create({ metadata })).thread_id;
  }
  await stream.client.threads.update(stream.threadId, { metadata });
  return stream.threadId;
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
            : phase === "sending"
              ? "Sending…"
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

function IntakeSuggestion({
  disabled,
  hasPacket,
}: {
  disabled: boolean;
  hasPacket: boolean;
}) {
  const { attachments, textInput } = usePromptInputController();

  function prepareIntake() {
    textInput.setInput(INTAKE_REQUEST);
    if (!hasPacket && !attachments.files.length) {
      attachments.openFileDialog();
    }
  }

  return (
    <Suggestions className="mt-3 flex-col items-stretch gap-1">
      <Suggestion
        className="h-auto w-full justify-start gap-3 rounded-xl border-transparent bg-transparent px-2 py-2 text-left shadow-none hover:border-transparent hover:bg-slate-50"
        disabled={disabled}
        onClick={prepareIntake}
        suggestion="Start a referral intake"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-stream-mist text-stream-teal">
          <Paperclip className="size-3.5" />
        </span>
        <span className="min-w-0 text-xs font-semibold text-slate-700">
          Start a referral intake
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

function ReferralChatPanel({
  stream,
  embedded = false,
  onNewChat,
}: ConversationProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);

  const state = useReferralState(stream);
  const hasPacket = Boolean(state.pdf_path);
  const interrupt = stream.interrupt?.value;
  const reviewPending = Boolean(interrupt);
  const uiMessages = state.ui ?? [];
  const savedMessages = (stream.values.messages ?? []) as StoredMessage[];
  const displayError = getDisplayError(uploadError, stream.error);

  async function submitMessage(text: string) {
    if (!text) return;
    try {
      await stream.submit({
        messages: [referralMessage(
          text,
          hasPacket && !stream.messages.length ? state : undefined,
        )],
      });
    } catch (error) {
      setUploadError(
        getErrorMessage(error, "Message could not be sent. Please try again."),
      );
      throw error;
    }
  }

  async function submitPdf(part: FileUIPart, text: string) {
    if (hasPacket) {
      const error = new Error(
        "This chat already has a PDF. Choose New chat to attach another.",
      );
      setUploadError(error.message);
      throw error;
    }
    setUploadPhase("uploading");
    try {
      const uploaded = await uploadFile(part);
      setUploadPhase("sending");
      const threadId = await ensureReferralThread(stream);
      await stream.submit(
        {
          messages: [
            referralMessage(text, {
              pdf_path: uploaded.path,
              pdf_name: uploaded.filename,
            }),
          ],
        },
        { threadId },
      );
    } catch (error) {
      setUploadError(getErrorMessage(error, "Upload failed."));
      throw error;
    } finally {
      setUploadPhase(null);
    }
  }

  async function handleSubmit(message: PromptInputMessage) {
    setUploadError(null);
    const text = message.text.trim();
    const [part] = message.files;
    return part ? submitPdf(part, text) : submitMessage(text);
  }

  async function respond(response: unknown) {
    setUploadError(null);
    await respondToReview(stream, response);
  }

  const isWorking = Boolean(uploadPhase) || stream.isLoading;
  const inputDisabled = isWorking || stream.isThreadLoading || reviewPending;
  const composerHint = reviewPending
    ? "Complete review to continue"
    : hasPacket
      ? null
      : "PDF · up to 15 MB";
  const submitStatus = isWorking
    ? "streaming"
    : displayError
      ? "error"
      : "ready";
  const lastMessage = stream.messages.at(-1);
  const lastAssistantText = lastMessage?.type === "ai"
    ? typeof lastMessage.content === "string"
      ? lastMessage.content
      : lastMessage.content.map((part) =>
          part.type === "text" && typeof part.text === "string" ? part.text : "",
        ).join("")
    : "";
  const streamingMessageId = isWorking && lastAssistantText.trim()
    ? lastMessage?.id
    : undefined;
  const hasConversation = Boolean(
    state.pdf_path ||
    stream.messages.length ||
    uiMessages.length ||
    displayError,
  );

  const showReferralUI = reviewPending || (isWorking && !state.outcome);
  const referralUI = showReferralUI
    ? uiMessages.map((message) => (
        <ReferralUIMessage
          canRespond={reviewPending}
          isLoading={stream.isLoading && !state.outcome}
          key={message.id}
          message={message}
          respond={respond}
          reviewHref={
            stream.threadId
              ? `/referrals/${stream.threadId}#clinical-findings`
              : undefined
          }
        />
      ))
    : [];
  const intakeMessage = stream.messages.find(
    (message) => isAIMessage(message) &&
      message.tool_calls?.some((call) => call.name === "referral_intake"),
  );
  const attachmentMessage = [...stream.messages].reverse().find((message) => {
    if (message.type !== "human") return false;
    const saved = savedMessages.find((item) => item.id === message.id);
    if (saved?.additional_kwargs?.referral || message.additional_kwargs?.referral) {
      return true;
    }
    const content = typeof message.content === "string"
      ? message.content
      : message.content.map((part) =>
          part.type === "text" && typeof part.text === "string" ? part.text : "",
        ).join("");
    return content.includes("Attached PDF:");
  });

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
            disabled={inputDisabled}
            placeholder="Ask Stream"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {!hasPacket && <AddFileButton disabled={inputDisabled} />}
            {composerHint && (
              <span className="hidden text-[11px] text-slate-400 sm:inline">
                {composerHint}
              </span>
            )}
          </PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-full bg-stream-blue text-white hover:bg-stream-teal disabled:bg-slate-200 disabled:text-slate-400"
            disabled={Boolean(uploadPhase) || stream.isThreadLoading || reviewPending}
            onStop={() => void stream.stop()}
            status={submitStatus}
          >
            {!isWorking && !displayError ? (
              <ArrowUp className="size-4" />
            ) : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      {!intakeMessage && !state.outcome && (
        <IntakeSuggestion disabled={inputDisabled} hasPacket={hasPacket} />
      )}
    </>
  );

  return (
    <aside
      aria-label={embedded ? "Referral conversation" : "Referral intake chat"}
      className={
        embedded
          ? "flex h-[440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
          : "mx-auto flex w-full max-w-[600px] min-h-[610px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-35px_rgba(16,39,72,0.28)] lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]"
      }
    >
      {hasConversation && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-stream-navy">Stream</span>
          {onNewChat ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-stream-blue hover:bg-stream-blue/10 disabled:opacity-50"
              disabled={isWorking}
              onClick={onNewChat}
              type="button"
            >
              <Plus className="size-3.5" />New chat
            </button>
          ) : (
            <Link className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-stream-blue hover:bg-stream-blue/10" href="/">
              <Plus className="size-3.5" />New chat
            </Link>
          )}
        </div>
      )}
      {!hasConversation ? (
        <div className="flex flex-1 items-center justify-center bg-[#fbfcfc] px-4 py-10">
          <div className="w-full max-w-[560px] -translate-y-8">{composer}</div>
        </div>
      ) : (
        <>
          <Conversation className="min-h-0 flex-1 bg-[#fbfcfc]">
            <ConversationContent className="mx-auto w-full max-w-[560px] gap-4 p-4">
              {stream.messages.map((message) => {
                const role = message.type;
                if (role !== "human" && role !== "ai") return null;
                const metadata = savedMessages.find((saved) => saved.id === message.id)?.additional_kwargs ??
                  message.additional_kwargs;
                const attachment = metadata.referral as ReferralState | undefined;
                const text = typeof metadata.display_text === "string"
                  ? metadata.display_text
                  : typeof message.content === "string"
                  ? message.content
                  : message.content.map((part) =>
                      part.type === "text" && typeof part.text === "string" ? part.text : "",
                    ).join("");
                return (
                  <Fragment key={message.id}>
                    {(text || attachment?.pdf_path) && (
                      <Message
                        className={role === "human" ? "max-w-[85%] items-end" : undefined}
                        from={role === "human" ? "user" : "assistant"}
                      >
                        <p className={`text-[11px] font-medium text-slate-400 ${role === "human" ? "text-right" : ""}`}>
                          {role === "human" ? "You" : "Stream"}
                        </p>
                        {role === "human" && attachment?.pdf_path && !attachment.outcome && (
                          <MessageContent className="border border-stream-blue/15 group-[.is-user]:rounded-2xl group-[.is-user]:bg-stream-blue/10 group-[.is-user]:text-stream-navy">
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-stream-coral">
                                <FileText className="size-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {attachment.pdf_name ?? "Referral packet.pdf"}
                                </p>
                                <p className="text-xs text-slate-400">PDF attachment</p>
                              </div>
                            </div>
                          </MessageContent>
                        )}
                        {text && (
                          <MessageContent className={role === "human"
                            ? "whitespace-pre-wrap break-words group-[.is-user]:rounded-2xl group-[.is-user]:bg-stream-blue/10 group-[.is-user]:text-stream-navy"
                            : "w-full break-words leading-relaxed text-slate-700"}>
                            {role === "ai"
                              ? (
                                  <MessageResponse
                                    isAnimating={message.id === streamingMessageId}
                                  >
                                    {text}
                                  </MessageResponse>
                                )
                              : text}
                          </MessageContent>
                        )}
                      </Message>
                    )}
                    {message.id === attachmentMessage?.id && referralUI}
                  </Fragment>
                );
              })}

              {!attachmentMessage && referralUI}

              {isWorking && !referralUI.length && !lastAssistantText.trim() && (
                <Message from="assistant">
                  <MessageContent className="text-sm font-medium">
                    <Shimmer>Thinking…</Shimmer>
                  </MessageContent>
                </Message>
              )}

              {displayError && (
                <Message from="assistant">
                  <MessageContent className="border border-rose-200 bg-rose-50 text-sm text-rose-700">
                    {displayError}
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-slate-100 bg-white p-4">
            <div className="mx-auto w-full max-w-[560px]">{composer}</div>
          </div>
        </>
      )}
    </aside>
  );
}

export function ReferralConversation(props: ConversationProps) {
  return (
    <PromptInputProvider>
      <ReferralChatPanel {...props} />
    </PromptInputProvider>
  );
}

function ChatSession({ onReferralChange, threadId, onReset }: ChatSessionProps) {
  const stream = useStream<Record<string, unknown>, ReviewInterrupt>({
    apiUrl: AGENT_SERVER_URL,
    assistantId: ASSISTANT_ID,
    threadId,
    onCompleted: onReferralChange,
    onThreadId: onReferralChange,
    optimistic: false,
  });

  const activeThreadId = stream.threadId;
  const interruptId = stream.interrupt?.id;
  const { client, isLoading } = stream;
  useEffect(() => {
    if (!activeThreadId || !interruptId || isLoading) return;
    let active = true;
    // A review can finish on the separate referral page. Reload the saved
    // conversation once it is idle so this chat does not stay paused.
    const timer = window.setInterval(async () => {
      try {
        const thread = await client.threads.get(activeThreadId);
        if (active && thread.status === "idle") onReset(activeThreadId);
      } catch {
        // Keep the current conversation and retry on the next interval.
      }
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeThreadId, interruptId, isLoading, client, onReset]);

  return <ReferralConversation stream={stream} onNewChat={() => onReset(null)} />;
}

export function ReferralChat(props: ReferralChatProps) {
  const [session, setSession] = useState({
    threadId: null as string | null,
    version: 0,
  });
  const reset = useCallback((threadId: string | null) => {
    setSession((current) => ({ threadId, version: current.version + 1 }));
  }, []);
  return (
    <ChatSession
      {...props}
      key={session.version}
      onReset={reset}
      threadId={session.threadId}
    />
  );
}
