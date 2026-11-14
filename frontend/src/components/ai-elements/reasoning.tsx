"use client";

import { useState, type ReactNode } from "react";
import { Brain, ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Shimmer } from "@/components/ai-elements/shimmer";

/** Collapsible agent activity, following the AI Elements Reasoning pattern. */
export function Reasoning({
  children,
  isStreaming = false,
  title = "Thinking…",
}: {
  children?: ReactNode;
  isStreaming?: boolean;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      className="w-full text-sm text-slate-500"
      open={isStreaming || expanded}
      onOpenChange={setExpanded}
    >
      <CollapsibleTrigger className="group inline-flex items-center gap-2 rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-stream-blue">
        <Brain aria-hidden="true" className="size-4 shrink-0" />
        {isStreaming ? <Shimmer>{title}</Shimmer> : <span>{title}</span>}
        {children && (
          <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
        )}
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent>
          <div className="ml-2 mt-2 space-y-2 border-l border-slate-200 pl-4 pb-1">
            {children}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
