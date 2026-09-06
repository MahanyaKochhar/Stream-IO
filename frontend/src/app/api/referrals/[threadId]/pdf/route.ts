import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { AGENT_SERVER_URL } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return new NextResponse("Invalid referral.", { status: 400 });
  }

  try {
    const response = await fetch(
      `${AGENT_SERVER_URL}/threads/${threadId}/state`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      return new NextResponse("Referral could not be loaded.", {
        status: response.status,
      });
    }
    const state = await response.json();
    const pdfPath = state.values?.pdf_path;
    if (typeof pdfPath !== "string" || !pdfPath.endsWith(".pdf")) {
      return new NextResponse("No source PDF is available.", { status: 404 });
    }

    // Same-host development storage, matching the upload route. Never serve
    // arbitrary filesystem paths supplied in graph state.
    const path = await realpath(pdfPath);
    const uploads = join(await realpath(tmpdir()), "referral-intake-uploads");
    const sample = resolve(process.cwd(), "../referral_packet.pdf");
    if (!path.startsWith(`${uploads}${sep}`) && path !== sample) {
      return new NextResponse("Source PDF is unavailable.", { status: 404 });
    }
    const pdf = await readFile(path);
    if (pdf.subarray(0, 5).toString() !== "%PDF-") {
      return new NextResponse("Source is not a PDF.", { status: 415 });
    }
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="referral-packet.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(
      "Source PDF is unavailable. It may have expired from temporary storage.",
      { status: 404 },
    );
  }
}
