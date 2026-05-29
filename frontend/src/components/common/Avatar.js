// Initials avatar with brand color ring. Placeholder for Phase 2 photo upload.
export const Avatar = ({ name = "?", color = "#22d3ee", size = 44, className = "" }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`flex items-center justify-center rounded-full font-display font-bold uppercase shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}1f`,
        color,
        border: `1.5px solid ${color}66`,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
};
