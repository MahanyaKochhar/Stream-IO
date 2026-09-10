import { resolve } from "node:path";

// Next.js runs from frontend/; keep uploaded files in the repository root.
export const PDF_UPLOAD_DIRECTORY = resolve(process.cwd(), "../data/uploads");
