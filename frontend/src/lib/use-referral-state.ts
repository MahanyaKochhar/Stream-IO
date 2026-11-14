"use client";

import { useChannel, type UseStreamReturn } from "@langchain/react";
import {
  referralState,
  type ReferralState,
  type ReviewInterrupt,
} from "@/lib/referrals";
import {
  readProgress,
  type ReferralProgress,
} from "@/lib/referral-presentation";

export type ReferralStream = UseStreamReturn<
  Record<string, unknown>,
  ReviewInterrupt
>;

export async function respondToReview(
  stream: ReferralStream,
  response: unknown,
) {
  if (!stream.interrupt)
    throw new Error("This referral is not waiting for review.");
  await stream.respond(response, { interruptId: stream.interrupt.id });
}

export function useReferralLive(stream: ReferralStream) {
  // An intake emits fewer than 32 public updates. A reset event starts each
  // invocation (including resume), so prior runs cannot leak into the next one.
  const events = useChannel(stream, ["custom"], null, { bufferSize: 64 });
  let live: ReferralState | undefined;
  let progress: ReferralProgress | undefined;
  for (const event of events) {
    const data = event.params.data as {
      type?: string;
      patch?: ReferralState;
      reset?: boolean;
      referral?: ReferralState;
    };
    if (data?.type === "referral_delta" && data.patch) {
      live = { ...(data.reset ? {} : live), ...data.patch };
      if (data.reset) progress = undefined;
    } else if (data?.type === "referral_progress") {
      progress = readProgress(data);
    } else if (data?.type === "referral_state") {
      live = data.referral; // Compatibility with older running servers.
    }
  }
  const saved = referralState(stream.values, stream.interrupt?.value);
  const state = stream.isLoading && !stream.interrupt ? (live ?? saved) : saved;
  return {
    state,
    progress: stream.isLoading ? progress : undefined,
  };
}

export function useReferralState(stream: ReferralStream): ReferralState {
  return useReferralLive(stream).state;
}
