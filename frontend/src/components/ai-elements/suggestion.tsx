"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Suggestions({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full items-center gap-2 overflow-x-auto", className)}
      {...props}
    />
  );
}

type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export function Suggestion({
  suggestion,
  onClick,
  className,
  children,
  ...props
}: SuggestionProps) {
  return (
    <Button
      className={cn(
        "h-8 shrink-0 rounded-full border-slate-200 bg-white px-3 text-xs font-medium text-stream-navy shadow-none hover:border-stream-teal/40 hover:bg-stream-mist",
        className
      )}
      onClick={() => onClick?.(suggestion)}
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? suggestion}
    </Button>
  );
}
