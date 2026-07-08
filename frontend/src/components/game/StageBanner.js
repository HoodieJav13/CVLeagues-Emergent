import { Trophy } from "@phosphor-icons/react";

// Playoff/tournament treatment (approved: gold banner strip). Gold is the
// achievement/emphasis token — the one brand color reserved for "this matters
// differently" — and per the three-signal rule the banner never relies on
// color alone: trophy icon + text label always ride along. Regular-season
// games render nothing.
const STAGE_LABELS = { playoff: "Playoffs", tournament: "Tournament" };

export const isSpecialStage = (game) => Boolean(game && STAGE_LABELS[game.stage]);

export const StageBanner = ({ stage, className = "" }) => {
  const label = STAGE_LABELS[stage];
  if (!label) return null;
  return (
    <div
      data-testid={`stage-banner-${stage}`}
      className={`flex items-center gap-1.5 bg-gold-tint text-gold text-label uppercase tracking-widest font-semibold ${className}`}
    >
      <Trophy size={13} weight="fill" aria-hidden="true" /> {label}
    </div>
  );
};
