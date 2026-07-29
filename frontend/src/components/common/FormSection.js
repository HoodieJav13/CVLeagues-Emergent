// Single-surface intake-form grammar (Pass 4 forms batch): the form is ONE
// card, and each step is a numbered section separated by internal hairlines
// instead of floating in its own rounded shell. Numbering gives a stranger a
// sense of length before they start — the courtesy paper forms always had.
export const FormSurface = ({ children, className = "" }) => (
  <div className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`.trim()}>
    {children}
  </div>
);

export const FormSection = ({ n, title, hint, children }) => (
  <section className="space-y-4 border-b border-border p-5 last:border-0">
    {title && (
      <p className="flex items-baseline gap-2 font-display text-sm uppercase tracking-tight text-foreground">
        <span className="font-mono-score font-bold tabular-nums text-primary">{String(n).padStart(2, "0")}</span>
        {title}
        {hint && <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">{hint}</span>}
      </p>
    )}
    {children}
  </section>
);
