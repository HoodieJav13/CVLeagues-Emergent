import { Link } from "react-router-dom";
import { Compass } from "@phosphor-icons/react";

// Catch-all 404 — keeps unknown URLs from rendering a blank layout body.
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 animate-fade-up" data-testid="not-found">
      <Compass size={48} weight="duotone" className="text-primary mb-4" />
      <p className="font-display uppercase tracking-widest text-primary text-xs font-semibold">404</p>
      <h1 className="font-display uppercase text-display-xl text-foreground mt-1">
        Page Not Found
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        That page is out of bounds. The link may be broken or the page may have moved.
      </p>
      <Link
        to="/"
        data-testid="not-found-home"
        className="mt-6 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-xl hover:bg-teal-deep transition-colors"
      >
        Back Home
      </Link>
    </div>
  );
}
