"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation === "vertical" ? "vertical" : "horizontal"}
      className={cn(
        "bg-border/80 shrink-0",
        orientation === "horizontal" ? "h-0.5 w-full" : "w-0.5 self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
