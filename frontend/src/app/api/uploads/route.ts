import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDF_UPLOAD_DIRECTORY } from "@/lib/pdf-storage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 415 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "The PDF must be 15 MB or smaller." },
      { status: 413 }
    );
  }

  const path = join(PDF_UPLOAD_DIRECTORY, `${randomUUID()}.pdf`);

  await mkdir(PDF_UPLOAD_DIRECTORY, { recursive: true });
  await writeFile(path, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    path,
    filename: file.name,
    size: file.size,
  });
}
