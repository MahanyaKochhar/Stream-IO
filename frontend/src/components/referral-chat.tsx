"use client";

import { useEffect, useMemo, useState } from "react";
import { useStream, type UseStreamReturn } from "@langchain/react";
import { ArrowUp, FileText, LoaderCircle, Paperclip } from "lucide-react";
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
import { Message, MessageContent } from "@/components/ai-elements/message";
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
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ReferralUIMessage } from "@/components/referral-ui";
import { useReferralMessages } from "@/lib/use-referral-messages";
import {
  AGENT_SERVER_URL,
  ASSISTANT_ID,
  type ReferralState,
  type ReviewInterrupt,
} from "@/lib/referrals";

type SubmittedFile = { filename: string; size: number };
type ReferralChatProps = { onReferralChange: () => void };
export type ReferralStream = UseStreamReturn<ReferralState, ReviewInterrupt>;
type ConversationProps = { stream: ReferralStream; embedded?: boolean };
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

function ReferralChatPanel({ stream, embedded = false }: ConversationProps) {
  const [submittedFile, setSubmittedFile] = useState<SubmittedFile | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);

  const conversation = useReferralMessages(stream.client, stream.threadId);
  const hasPacket = Boolean(stream.values.pdf_path);
  const interrupt = stream.interrupt?.value;
  const uiMessages = stream.values.ui ?? [];
  const errorMessage = useMemo(() => {
    if (uploadError) return uploadError;
    if (conversation.error) return conversation.error;
    if (!stream.error) return null;
    return stream.error instanceof Error
      ? stream.error.message
      : "The agent run could not be completed.";
  }, [stream.error, uploadError, conversation.error]);

  async function uploadFile(
    part: FileUIPart,
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
      try {
        await conversation.sendMessage(message.text);
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : "Message could not be saved. Please try again.",
        );
        throw error;
      }
      return;
    }

    if (hasPacket) {
      const error = new Error(
        "This conversation already has a referral packet. Send a message about this referral instead.",
      );
      setUploadError(error.message);
      throw error;
    }
    setUploadPhase("uploading");
    try {
      const uploaded = await uploadFile(part);
      setSubmittedFile(uploaded);
      setUploadPhase("processing");
      await stream.submit({
        pdf_path: uploaded.path,
        pdf_name: uploaded.filename,
      });
      if (message.text.trim())
        await conversation.sendMessage(
          message.text,
          stream.getThread()?.threadId,
        );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      throw error;
    } finally {
      setUploadPhase(null);
    }
  }

  async function respond(response: unknown) {
    setUploadError(null);
    await stream.respond(response, { interruptId: stream.interrupt?.id });
  }

  const isWorking = Boolean(uploadPhase) || stream.isLoading;
  const inputDisabled = isWorking || conversation.isSending;
  const hasConversation = Boolean(
    submittedFile ||
    stream.values.pdf_path ||
    uiMessages.length ||
    errorMessage,
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
            disabled={inputDisabled}
            placeholder={
              hasPacket
                ? "Message about this referral…"
                : "Add a note or attach a referral PDF…"
            }
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {!hasPacket && <AddFileButton disabled={inputDisabled} />}
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              {hasPacket
                ? "Messages stay with this referral"
                : "PDF · up to 15 MB"}
            </span>
          </PromptInputTools>
          <PromptInputSubmit
            className="size-8 rounded-full bg-stream-blue text-white hover:bg-stream-teal disabled:bg-slate-200 disabled:text-slate-400"
            disabled={inputDisabled}
            onStop={() => void stream.stop()}
            status={
              isWorking
                ? "streaming"
                : conversation.isSending
                  ? "submitted"
                  : errorMessage
                    ? "error"
                    : "ready"
            }
          >
            {!isWorking && !errorMessage ? (
              <ArrowUp className="size-4" />
            ) : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      {!hasConversation && <UploadSuggestion disabled={isWorking} />}
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
      {!hasConversation ? (
        <div className="flex flex-1 items-center justify-center bg-[#fbfcfc] px-4 py-10">
          <div className="w-full max-w-[560px] -translate-y-8">{composer}</div>
        </div>
      ) : (
        <>
          <Conversation className="min-h-0 flex-1 bg-[#fbfcfc]">
            <ConversationContent className="mx-auto w-full max-w-[560px] gap-4 p-4">
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

              {isWorking && !uiMessages.length && (
                <Message from="assistant">
                  <MessageContent className="text-sm text-slate-500">
                    Starting referral intake…
                  </MessageContent>
                </Message>
              )}

              {uiMessages.map((message) => (
                <ReferralUIMessage
                  canRespond={Boolean(interrupt)}
                  isLoading={stream.isLoading}
                  key={message.id}
                  message={message}
                  respond={respond}
                  reviewHref={
                    stream.threadId
                      ? `/referrals/${stream.threadId}#clinical-findings`
                      : undefined
                  }
                />
              ))}

              {conversation.messages.map((message) => (
                <Message from="user" key={message.id}>
                  <MessageContent className="whitespace-pre-wrap break-words">
                    {message.text}
                  </MessageContent>
                  <span className="text-right text-[10px] text-slate-400">
                    Saved to this referral
                  </span>
                </Message>
              ))}

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

export function ReferralChat({ onReferralChange }: ReferralChatProps) {
  const stream = useStream<ReferralState, ReviewInterrupt>({
    apiUrl: AGENT_SERVER_URL,
    assistantId: ASSISTANT_ID,
    onCompleted: onReferralChange,
    onThreadId: onReferralChange,
    optimistic: false,
  });
  return <ReferralConversation stream={stream} />;
}
