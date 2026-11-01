import { useCallback, useEffect, useState } from "react";
import { canonicalSpec } from "../../lib/film";
import { mediaUrl, sha256OfUrl } from "../replay/replayIO";

/* Season Film I/O: the loopback film helper client, the browser-side spec hash
 * (same canonical bytes the helper hashes) and a media check across every
 * recording a film uses. Network failures become recoverable states. */

export const FILM_HELPER_URL = (process.env.REACT_APP_FILM_HELPER_URL || "").replace(/\/$/, "");
const GONE = { state: "failed", code: "HELPER", message: "The local film helper is not responding. Start it with the preview launcher, then retry." };

export async function specSha256(sequence) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser blocks hashing on an insecure address. Open the preview at http://127.0.0.1 to render.");
  const bytes = new TextEncoder().encode(canonicalSpec(sequence));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function call(path, options) {
  if (!FILM_HELPER_URL) return { ...GONE, message: "The film helper is not configured for this preview." };
  try {
    const res = await fetch(`${FILM_HELPER_URL}${path}`, { cache: "no-store", ...options });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && !body.state) return { state: "failed", code: body.code || "HELPER", message: body.message || "The render was refused.", detail: body.detail };
    return body;
  } catch {
    return GONE;
  }
}

export const filmHelperHealth = () => call("/health");
export const startFilmRender = (payload) => call("/films/renders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
export const filmRenderStatus = (id) => call(`/films/renders/${id}`);
export const cancelFilmRender = (id) => call(`/films/renders/${id}/cancel`, { method: "POST" });
// Saved edition files, addressed by film and file name (survive helper restarts).
export const editionFileUrl = (film_id, name) => `${FILM_HELPER_URL}/films/${film_id}/files/${name}`;

// Every segment of the given recordings checked against this computer's files.
export function useRecordingsMediaCheck(recordings) {
  const [status, setStatus] = useState({});
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((n) => n + 1), []);
  const key = recordings.map((r) => `${r.id}:${r.source_revision}`).join("|");
  useEffect(() => {
    let cancelled = false;
    recordings.flatMap((r) => r.segments).forEach(async (segment) => {
      let next;
      try {
        const found = await sha256OfUrl(mediaUrl(segment.media.path));
        if (found.missing) next = { state: "missing" };
        else next = found.sha256 === segment.media.sha256 ? { state: "ok", sha256: found.sha256 } : { state: "replaced", sha256: found.sha256 };
      } catch (error) {
        next = { state: "error", reason: error.message };
      }
      if (!cancelled) setStatus((prev) => ({ ...prev, [segment.id]: next }));
    });
    return () => { cancelled = true; };
  }, [key, round]); // eslint-disable-line react-hooks/exhaustive-deps
  return [status, recheck];
}
