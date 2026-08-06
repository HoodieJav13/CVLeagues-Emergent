# Waiver review package — for a New Mexico attorney

**Date:** 2026-08-06 · **Prepared for:** the league owner, to forward to a New
Mexico attorney. **Status:** launch is blocked on the attorney-approved text
regardless of every other gate; this document exists so the engagement can
start immediately.

## What we are asking the attorney for

Final, enforceable liability-waiver text for an adult recreational sports
league (kickball and flag football) operating in Albuquerque, New Mexico —
drafted or reviewed under New Mexico law. **No draft legal language exists in
the system**, deliberately: the software refuses to operate with placeholder
legal text, so the attorney's text is not a review of ours, it is the text.

## The league, in one paragraph

CVF Sports runs adult (18+) recreational kickball and flag football leagues at
public parks in Albuquerque. Players register online; every player must sign
the waiver electronically before being eligible; a single league administrator
verifies signatures against rosters. No minors participate in Season 1 (a
minor/guardian flow is explicitly out of scope for now, but flagging whether
the text should anticipate one is welcome).

## Exactly what the system records with each signature

The signature is electronic (typed name plus checkbox attestations, no drawn
signature). Each signed record stores, immutably:

| Field | Notes |
|---|---|
| Signed name (typed) | Required |
| Email | Required |
| Phone | Optional |
| Signing timestamp | Server-side, timezone-aware |
| Exact waiver version signed | The full text of every version is stored verbatim, permanently, keyed like `CVF-WAIVER-2026-06-04-v1`; a signature is bound to its version |
| "I accept the terms" | Required checkbox; a record cannot exist without it |
| "I confirm I am 18 or older" | Checkbox; a FALSE attestation is recorded and rejected rather than silently blocked |
| Media consent (photos/video) | Separate optional checkbox — not bundled with the liability terms |
| IP address and browser user-agent | Captured at signing |

Records are append-only: a signed waiver is never edited; re-signing creates a
new record against the then-current version. Signature happens on its own page,
never bundled into a registration form.

## Questions for the attorney

1. Enforceability of this **electronic signature form** (typed name +
   checkboxes + IP/timestamp capture) for a recreational-activity liability
   waiver under New Mexico law — and anything that should be added to the
   capture to strengthen it.
2. New Mexico-specific limits on recreational liability waivers: what a court
   here will and will not enforce (e.g., ordinary negligence vs. gross
   negligence), and how the text should be scoped accordingly.
3. Required or advisable elements: assumption of risk, release and hold
   harmless, indemnification, medical treatment consent/authorization,
   COVID/communicable-disease language if still advisable, venue/park
   third-party considerations (games occur at City of Albuquerque public
   parks), and choice of law/venue.
4. Whether the **media consent** should remain a separate optional grant (our
   strong preference — participation must not be conditioned on it) and any
   wording it needs.
5. The **18+ attestation**: is self-attestation sufficient, or should the text
   or process demand more?
6. Business-form exposure: the owner operates the league personally today.
   Any observation about who the released party should be named as (and
   whether an LLC materially changes the waiver's protection) is welcome,
   understanding that entity formation is a separate engagement.
7. Anything about **versioning** we should know: when text changes, every
   player re-signs the new version; is that sufficient, or do changes ever
   need more than re-signature?

## What happens with the delivered text

The approved text is inserted verbatim as a new immutable version and becomes
the only text ever shown to a signer. It is stored permanently alongside every
signature made against it. Nothing paraphrases it, truncates it, or displays a
summary in its place.

## Practical notes for the owner

- Ask for a flat-fee quote for a single-activity waiver review; this is a
  well-trodden document type.
- The two sports can share one waiver if the attorney is comfortable naming
  both activities; ask rather than assume.
- Deliverable format: plain text is ideal (it is stored and rendered as
  text); PDF is fine as long as a text version accompanies it.
