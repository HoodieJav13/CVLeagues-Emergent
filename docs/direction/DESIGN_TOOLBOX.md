# Design toolbox — adopted instruments, QA nets, and rejected tools

**Date:** 2026-08-12 · Curated from two owner-supplied batches during the
post-Pass-5 direction work. This file is the durable bookmark set: future
sessions consult it before adopting any design tooling, and the *Rejected*
section exists so rejected tools are not silently re-adopted.

## Installed

| Tool | What | Where |
|---|---|---|
| [Agentation](https://www.agentation.com/) v3 | Click-to-annotate the live UI; structured output (selector, component, styles, note) pastes straight to a coding agent. The owner's partner can mark up the real app instead of describing it. | `frontend` devDependency; mounts dev-only in `App.js` behind a `NODE_ENV` guard — never ships. Toolbar bottom-right of any dev page. |
| [prefer-container-queries](https://github.com/flornkm/skills) (MIT) | Skill: components respond to their own width, not the viewport — right default for cards/panels reused across layouts. | Vendored at `.claude/skills/prefer-container-queries/SKILL.md`. |

## Instruments (bookmarked; used during token/motion/depth work)

- **[oklch.fyi](https://oklch.fyi/)** — OKLCH color workspace. THE instrument
  for the day/night twin palettes: hold hue+chroma, flip lightness, and the
  pair stays perceptually matched. Also for warming the classic ink without
  breaking contrast ratios.
- **[easing.dev](https://www.easing.dev/)** — easing curve reference. Motion
  tokens get named curves, not defaults; "expensive-feeling" is mostly a
  curve choice.
- **[shadowLab](https://shadowlab.mocarski.design/)** — layered box-shadow
  builder. The tuned-classic depth system uses 2–3 layered shadows plus an
  inset top light instead of 1px borders.

## QA nets (bookmarked; used at review time)

- **[designsystemchecklist.com](https://www.designsystemchecklist.com/)** —
  system-level: foundations, tokens, motion, patterns. The retheme's
  token-phase completeness net.
- **[checklist.design](https://www.checklist.design/)** — component-level:
  per-control state coverage (hover, focus, error, disabled, empty). The
  retheme's surface-phase completeness net.

## Browse-for-taste (owner-facing; agents cannot browse these usefully)

- **[recent.design](https://recent.design)** (bot-blocked) and
  **[desengs.com](https://desengs.com)** — galleries/directories. Convert to
  direction only one way: the owner screenshots the 3–5 things that land and
  sends them in; chosen references become addendum anchors.

## Trial candidate (owner decision required — service account + likely cost)

- **[rams.ai](https://www.rams.ai/)** — automated design review (291 rules,
  0–100 score, PR integration). Philosophically a fit (an authorization
  matrix for design quality) and worth a trial on the tuned-classic track.
  Leash: its generic rules will fight deliberately unusual contract choices
  (e.g. hard offset shadows), so findings are treated like external audits —
  **verified, never obeyed**. Not installed; needs the owner's account.

## Rejected — do not re-adopt without a new owner decision

- **[tasteskill.dev](https://www.tasteskill.dev/)** — opinionated taste
  framework; would create a second design authority beside the Art Direction
  Contract. The contract is the authority.
- **[impeccable.style](https://impeccable.style/)** — "world decks" are
  pre-built design systems, i.e. templates — the opposite of the direction
  work; its check layer duplicates rams. One reviewer max.
- **[ui-skills.com](https://www.ui-skills.com/)** — unverifiable (bot-blocked);
  same genre as taste-skill. Evaluate a specific named skill if one is wanted.
- **[uiverse.io](https://uiverse.io)** — community CSS snippets; templated
  grammar, conflicts with the token system and the contract's no-drop-in rule.
  Browsing for micro-interaction *ideas* is fine; anything liked is rebuilt
  natively.
- **[penpot.app](https://penpot.app)** — fine product, wrong workflow: the
  design-in-code loop (build variants → owner reacts on phone → winner is
  half-implemented already) beat canvas tools in practice here.
- **ai-website-cloner-template** — clones other sites' looks; identity work
  is the point. Also derivative-work risk.
