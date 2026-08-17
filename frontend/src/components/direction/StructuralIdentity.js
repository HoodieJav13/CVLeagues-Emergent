const STRUCTURAL_TONES = {
  teal: "var(--cvf-teal)",
  gold: "var(--cvf-gold)",
  neutral: "var(--border-strong)",
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const StructuralCorner = ({
  className = "",
  color,
  position = "top-right",
  size = "default",
  tone = "teal",
}) => (
  <span
    aria-hidden="true"
    className={`cvf-structural-corner cvf-structural-corner--${size} ${className}`.trim()}
    data-position={position}
    style={{ "--cvf-structural-color": color || STRUCTURAL_TONES[tone] || STRUCTURAL_TONES.teal }}
  >
    <span />
    <span />
    <span />
  </span>
);

export const StructuralIdentityBadge = ({ className = "", color, name, team, testId }) => {
  const displayName = team?.name || name || "Team";
  const identityColor = team?.logo_color || color || "var(--text-secondary)";

  return (
    <span
      aria-hidden="true"
      className={`cvf-identity-badge ${className}`.trim()}
      data-cvf-identity-badge="true"
      data-testid={testId}
      style={{ "--cvf-identity-color": identityColor }}
    >
      <span className="cvf-identity-badge__offset" />
      <span className="cvf-identity-badge__field" />
      <span className="cvf-identity-badge__initials">{initials(displayName)}</span>
    </span>
  );
};

export const StatStrip = ({ className = "", items = [], testId }) => (
  <dl className={`cvf-stat-strip ${className}`.trim()} data-testid={testId}>
    {items.map((item) => (
      <div className="cvf-stat-strip__cell" key={item.key || item.label}>
        <dt className="cvf-stat-strip__label">{item.label}</dt>
        <dd className="cvf-stat-strip__value" style={item.color ? { color: item.color } : undefined}>
          {item.value}
          {item.sub != null && (
            <span className="cvf-stat-strip__sub" data-testid={item.subTestId}>{item.sub}</span>
          )}
        </dd>
      </div>
    ))}
  </dl>
);
