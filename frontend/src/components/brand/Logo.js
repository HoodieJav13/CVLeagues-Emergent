import { Link } from "react-router-dom";
import logoSrc from "../../assets/cvf-logo-transparent.png";

// Primary brand logo (local asset).
const LOGO_URL = logoSrc;

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
      className="rounded-lg object-contain"
      style={{ width: size, height: size }}
    />
    {withWord && (
      <div className="leading-none">
        <span className="font-display font-bold uppercase tracking-tight text-foreground text-xl block">
          CVF<span className="text-primary"> Sports</span>
        </span>
        <span className="text-micro text-muted-foreground tracking-widest uppercase">
          Albuquerque, NM
        </span>
      </div>
    )}
  </Link>
);
