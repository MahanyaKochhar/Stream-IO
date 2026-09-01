import { ReferralDetail } from "@/components/referral-detail";

export default async function ReferralDetailPage({
  params,
}: PageProps<"/referrals/[threadId]">) {
  const { threadId } = await params;
  return <ReferralDetail threadId={threadId} />;
}
