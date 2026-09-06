"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { PdfPage } from "@/components/pdf-page";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  LoaderCircle,
} from "lucide-react";

export function SourcePdf({ threadId }: { threadId: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/referrals/${threadId}/pdf`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await response.text());
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        const pdf = await task.promise;
        if (controller.signal.aborted) {
          await task.destroy();
          return;
        }
        setDocument(pdf);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Source PDF could not be loaded.",
          );
      }
    }
    void load();
    return () => {
      controller.abort();
      void task?.destroy();
    };
  }, [threadId, attempt]);

  const iconButton =
    "rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-stream-blue";

  return (
    <div
      id="source-pdf"
      aria-label="Source PDF"
      className="flex min-h-0 flex-1 flex-col"
    >
      {document ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={iconButton}
                disabled={pageNumber === 1}
                onClick={() => setPageNumber((value) => value - 1)}
                aria-label="Previous PDF page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span
                role="status"
                className="min-w-14 text-center text-xs text-slate-500"
              >
                {pageNumber} / {document.numPages}
              </span>
              <button
                type="button"
                className={iconButton}
                disabled={pageNumber === document.numPages}
                onClick={() => setPageNumber((value) => value + 1)}
                aria-label="Next PDF page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={iconButton}
                disabled={zoom <= 0.75}
                onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                onClick={() => setZoom(1)}
                aria-label="Fit PDF to width"
              >
                {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                type="button"
                className={iconButton}
                disabled={zoom >= 2}
                onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
          <PdfPage
            key={`${pageNumber}-${zoom}`}
            document={document}
            pageNumber={pageNumber}
            zoom={zoom}
          />
        </>
      ) : error ? (
        <div
          role="alert"
          className="m-auto max-w-sm p-6 text-center text-sm leading-6 text-slate-500"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
            className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-800 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          role="status"
          className="m-auto flex items-center gap-2 text-sm text-slate-500"
        >
          <LoaderCircle className="size-4 animate-spin" /> Loading source PDF…
        </div>
      )}
    </div>
  );
}
