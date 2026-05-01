import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border-2 border-transparent px-2 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-2.5!",
  {
    variants: {
      variant: {
        default:
          "border-primary/80 bg-primary text-primary-foreground shadow-[0_2px_0_var(--shadow-soft)] [a]:hover:bg-primary/90",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[0_2px_0_var(--shadow-soft)] [a]:hover:bg-secondary/90",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 shadow-[0_2px_0_var(--shadow-soft)] dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border bg-card text-foreground shadow-[0_2px_0_var(--shadow-soft)] [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
