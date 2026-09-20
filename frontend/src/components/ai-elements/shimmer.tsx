import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Shimmer({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ai-shimmer", className)} {...props} />;
}
