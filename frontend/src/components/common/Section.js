// Small reusable section heading with an accent rule.
// `as` controls the heading level ("h1" for a page-level title, default "h2"
// for sections) — semantic only, the visual treatment is identical.
export const SectionHeading = ({ title, subtitle, action, as: Tag = "h2", className = "" }) => (
  <div className={`flex items-end justify-between gap-4 mb-5 ${className}`}>
    <div>
      <div className="flex items-center gap-2.5 mb-0.5">
        <span className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <Tag className="font-display uppercase tracking-tighter text-display-lg text-foreground">
          {title}
        </Tag>
      </div>
      {subtitle && <p className="text-caption text-muted-foreground mt-1 ml-[14px]">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon, title, message }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    {Icon && <Icon size={40} weight="duotone" className="text-muted-foreground mb-3" />}
    <p className="font-display uppercase tracking-tight text-subheading text-foreground">{title}</p>
    {message && <p className="text-caption text-muted-foreground mt-1 max-w-xs">{message}</p>}
  </div>
);
