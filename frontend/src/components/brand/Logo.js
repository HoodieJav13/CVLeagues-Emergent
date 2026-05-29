import { Link } from "react-router-dom";

// Primary brand logo (uploaded CVF / Core Value Fitness hex mark).
const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_25817560-5d06-4585-aa10-457413ce1b96/artifacts/r9hewz9k_3.png";

export const Logo = ({ size = 36, withWord = true, className = "" }) => (
  <Link
    to="/"
    data-testid="brand-logo"
    className={`flex items-center gap-2.5 group ${className}`}
  >
    <img
      src={LOGO_URL}
      alt="CVF Sports"
      width={size}
      height={size}
      className="rounded-lg object-contain transition-transform duration-200 group-hover:scale-105"
      style={{ width: size, height: size }}
    />
    {withWord && (
      <div className="leading-none">
        <span className="font-display font-extrabold uppercase tracking-tighter text-white text-xl block">
          CVF<span className="text-primary"> Sports</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          Albuquerque, NM
        </span>
      </div>
    )}
  </Link>
);
