"use client";

import { useChannel, type UseStreamReturn } from "@langchain/react";
import {
  referralState,
  type ReferralState,
  type ReviewInterrupt,
} from "@/lib/referrals";

export type ReferralStream = UseStreamReturn<Record<string, unknown>, ReviewInterrupt>;

export async function respondToReview(stream: ReferralStream, response: unknown) {
  if (!stream.interrupt) {
    throw new Error("This referral is not waiting for review.");
  }
  await stream.respond(response, {
    interruptId: stream.interrupt.id,
  });
}

export function useReferralState(stream: ReferralStream): ReferralState {
  const events = useChannel(stream, ["custom"], null, { bufferSize: 1 });
  const event = events.at(-1)?.params.data as {
    type?: string;
    referral?: ReferralState;
  } | undefined;
  const live = event?.type === "referral_state"
    ? event.referral
    : undefined;
  return (stream.isLoading || stream.interrupt ? live : undefined) ??
    referralState(stream.values, stream.interrupt?.value);
}
