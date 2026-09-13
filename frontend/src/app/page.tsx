import { ReferralWorkspace } from "@/components/referral-workspace";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string | string[] }>;
}) {
  const { queue } = await searchParams;
  const queueView = queue === "completed" || queue === "review" ? queue : "processing";

  return <ReferralWorkspace queueView={queueView} />;
}
