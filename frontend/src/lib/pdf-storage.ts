import { basename, posix, resolve } from "node:path";

// Next.js runs from frontend/; keep uploaded files in the repository root.
export const PDF_UPLOAD_DIRECTORY = resolve(process.cwd(), "../data/uploads");

// Docker mounts the same directory here for the LangGraph backend.
export const BACKEND_PDF_UPLOAD_DIRECTORY = "/uploads";

export function localPdfPath(pdfPath: string): string {
  if (posix.dirname(pdfPath) === BACKEND_PDF_UPLOAD_DIRECTORY) {
    return resolve(PDF_UPLOAD_DIRECTORY, basename(pdfPath));
  }
  // Existing referrals may still contain a host path. The viewer validates it.
  return pdfPath;
}
