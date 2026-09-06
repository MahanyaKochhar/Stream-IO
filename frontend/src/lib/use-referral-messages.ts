"use client";

import { useEffect, useState } from "react";
import type { Client, Item } from "@langchain/langgraph-sdk";

type ReferralMessage = { id: string; text: string; createdAt: string };

function messageFromItem(item: Item): ReferralMessage {
  return {
    id: item.key,
    text: String(item.value.text ?? ""),
    createdAt: item.createdAt,
  };
}

function mergeMessages(
  current: ReferralMessage[],
  incoming: ReferralMessage[],
) {
  return [
    ...new Map(
      [...current, ...incoming].map((message) => [message.id, message]),
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

// Keep conversation messages on the referral without changing the graph's
// paused checkpoint or consuming its coordinator-review interrupt.
export function useReferralMessages(client: Client, threadId: string | null) {
  const [snapshot, setSnapshot] = useState<{
    threadId: string;
    messages: ReferralMessage[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!threadId) return;
    const id = threadId;
    const controller = new AbortController();
    async function load() {
      try {
        const messages: ReferralMessage[] = [];
        let offset = 0;
        while (!controller.signal.aborted) {
          const result = await client.store.searchItems(["referral-chat", id], {
            limit: 100,
            offset,
            signal: controller.signal,
          });
          messages.push(...result.items.map(messageFromItem));
          if (result.items.length < 100) break;
          offset += 100;
        }
        if (!controller.signal.aborted) {
          setSnapshot((current) => ({
            threadId: id,
            messages: mergeMessages(
              current?.threadId === threadId ? current.messages : [],
              messages,
            ),
          }));
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted)
          setError("Conversation history could not be loaded. Retrying…");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [client, threadId]);

  async function sendMessage(text: string, targetThreadId = threadId) {
    if (!targetThreadId)
      throw new Error("Start a referral before sending a message.");
    const content = text.trim();
    if (!content) return;
    setIsSending(true);
    try {
      const key = crypto.randomUUID();
      const namespace = ["referral-chat", targetThreadId];
      await client.store.putItem(
        namespace,
        key,
        { text: content },
        { index: false },
      );
      const saved = await client.store.getItem(namespace, key);
      if (!saved)
        throw new Error("Message could not be retrieved after saving.");
      setSnapshot((current) => ({
        threadId: targetThreadId,
        messages: mergeMessages(
          current?.threadId === targetThreadId ? current.messages : [],
          [messageFromItem(saved)],
        ),
      }));
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages: snapshot?.threadId === threadId ? snapshot.messages : [],
    sendMessage,
    isSending,
    error,
  };
}
