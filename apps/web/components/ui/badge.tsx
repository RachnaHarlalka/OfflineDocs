import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        /* --- DocSync additions ---------------------------------------------------
           Document-state badges. Soft fill + accent text + an alpha of the accent as
           the outline, because the palette has no *-border tokens (see
           docs/DESIGN_SYSTEM.md). Kept here so the four places that show status all
           read from one table. */
        success: "border-success/25 bg-success-soft text-success",
        warning: "border-warning/25 bg-warning-soft text-warning",
        /* Non-status: feature pills, active nav, owner badge. */
        brand: "border-primary/25 bg-primary-soft text-primary",
        /* Editor/Viewer role chips. */
        neutral: "bg-accent text-foreground",
        /* Draft sync state. --neutral is dot-only at 2.36:1 contrast as text,
           so the label itself uses muted-foreground, not --neutral. */
        draft: "bg-accent text-muted-foreground",
      },
      size: {
        default: "",
        /* 10.5px, per the login design's badge spec. The type scale's 10.5px step
           (`text-label`) carries 0.08em tracking for uppercase labels, which reads wrong
           on a status word — so the size is explicit, but it lives here once rather than
           inline at each call site. */
        sm: "h-[1.125rem] px-2 py-px text-[0.65625rem]/[1.35]",
        /* 24px / 11.5px, per the dashboard design's badge spec (role chips,
           status pills) — a distinct step from `sm`'s login-page pills, not
           an inline override, so every dashboard badge reads from one place. */
        md: "h-6 gap-1.5 px-2.25 text-[11.5px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      size,
    },
  })
}

export { Badge, badgeVariants }
