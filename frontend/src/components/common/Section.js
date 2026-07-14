import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";

// Small reusable section heading.
// `as` controls the heading level ("h1" for a page-level title, default "h2"
// for sections) — semantic only.
// `band` (public page titles only) renders the title on the ink band —
// the logo's stencil-on-band device. Admin/ops headers never set it.
export const SectionHeading = ({ title, subtitle, action, as: Tag = "h2", band = false, className = "" }) => (
  <div className={`flex items-end justify-between gap-4 mb-5 ${className}`}>
    <div>
      {band ? (
        <Tag className="cvf-band text-display-lg">{title}</Tag>
      ) : (
        <div className="flex items-center gap-2.5 mb-0.5">
          <span className="w-1 h-5 rounded-full bg-primary shrink-0" />
          <Tag className="font-display uppercase text-display-lg text-foreground">{title}</Tag>
        </div>
      )}
      {subtitle && <p className={`text-caption text-muted-foreground mt-1 ${band ? "ml-1" : "ml-[14px]"}`}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon, title, message, action, density = "spacious", className = "", ...props }) => (
  <Empty className={`${density === "compact" ? "py-6 px-4" : density === "default" ? "py-10 px-5" : "py-14 px-6"} ${className}`} {...props}>
    <EmptyHeader>
      {Icon && <EmptyMedia><Icon size={density === "compact" ? 30 : 40} weight="duotone" /></EmptyMedia>}
      <EmptyTitle>{title}</EmptyTitle>
      {message && <EmptyDescription>{message}</EmptyDescription>}
    </EmptyHeader>
    {action && <EmptyContent>{action}</EmptyContent>}
  </Empty>
);
