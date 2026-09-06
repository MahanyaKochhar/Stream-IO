"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type Props = { document: PDFDocumentProxy; pageNumber: number; zoom: number };

export function PdfPage({ document, pageNumber, zoom }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    async function draw() {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({
          scale: ((width - 32) / page.getViewport({ scale: 1 }).width) * zoom,
        });
        const density = window.devicePixelRatio || 1;
        const element = canvas.current;
        element.width = Math.floor(viewport.width * density);
        element.height = Math.floor(viewport.height * density);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        render = page.render({
          canvas: element,
          viewport,
          transform: [density, 0, 0, density, 0, 0],
        });
        await render.promise;
        const content = await page.getTextContent();
        if (!cancelled)
          setText(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
      } catch (failure) {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "This page could not be displayed.",
          );
      }
    }
    void draw();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, pageNumber, width, zoom]);

  return (
    <div ref={container} className="min-h-0 flex-1 overflow-auto bg-slate-50">
      {error ? (
        <p role="alert" className="p-6 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        <div className="w-max min-w-full p-4">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Source PDF, page ${pageNumber} of ${document.numPages}`}
            className="mx-auto bg-white shadow-sm"
          />
          <p className="sr-only">{text}</p>
        </div>
      )}
    </div>
  );
}
