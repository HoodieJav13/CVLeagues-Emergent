import { useCallback, useEffect, useState } from "react";

/* ============================================================================
 * Replay Studio I/O: everything that touches the network or media lives here so
 * the model (lib/replay.js) stays pure. All requests are same-origin static
 * files (public/replay-media) or the loopback export helper on 127.0.0.1.
 * ========================================================================== */

export const mediaUrl = (path) => `${process.env.PUBLIC_URL || ""}/${path}`;
export const EXPORT_HELPER_URL = (process.env.REACT_APP_REPLAY_EXPORT_URL || "").replace(/\/$/, "");

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256OfUrl(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error(`Could not read ${url} (${res.status})`);
  // Single-page dev servers answer a missing file with their HTML shell (200);
  // that is missing footage, not replaced footage.
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (type && !type.startsWith("video/") && !type.startsWith("application/octet-stream")) return { missing: true };
  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) return { missing: true };
  return { sha256: toHex(await crypto.subtle.digest("SHA-256", buffer)), bytes: buffer.byteLength };
}

// Duration of a media file as the browser decodes it.
export function measureDurationMs(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Math.round(video.duration * 1000));
    video.onerror = () => reject(new Error("This browser could not read the replacement footage."));
    video.src = url;
  });
}

// Checks every registered segment against the file actually on this device.
// state per segment: checking | ok | missing | replaced | error
export function useMediaCheck(recording) {
  const [status, setStatus] = useState({});
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((n) => n + 1), []);
  useEffect(() => {
    if (!recording) { setStatus({}); return undefined; }
    let cancelled = false;
    setStatus(Object.fromEntries(recording.segments.map((s) => [s.id, { state: "checking" }])));
    recording.segments.forEach(async (segment) => {
      let next;
      try {
        const found = await sha256OfUrl(mediaUrl(segment.media.path));
        if (found.missing) next = { state: "missing" };
        else if (found.sha256 !== segment.media.sha256) next = { state: "replaced", sha256: found.sha256, bytes: found.bytes };
        else next = { state: "ok", sha256: found.sha256 };
      } catch (error) {
        next = { state: "error", reason: error.message };
      }
      if (!cancelled) setStatus((prev) => ({ ...prev, [segment.id]: next }));
    });
    return () => { cancelled = true; };
  }, [recording, round]);
  return [status, recheck];
}

/* ---------------------------- export helper client ----------------------- */

export async function helperHealth() {
  if (!EXPORT_HELPER_URL) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(`${EXPORT_HELPER_URL}/health`, { cache: "no-store" });
    return res.ok ? { ok: true, ...(await res.json()) } : { ok: false, reason: "unhealthy" };
  } catch {
    return { ok: false, reason: "not-running" };
  }
}

export async function startExport(manifest) {
  const res = await fetch(`${EXPORT_HELPER_URL}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { state: "failed", code: body.code || "SCHEMA", message: body.message || "The export was refused.", detail: body.detail };
  return body;
}

export async function exportStatus(id) {
  const res = await fetch(`${EXPORT_HELPER_URL}/exports/${id}`, { cache: "no-store" });
  if (!res.ok) return { state: "failed", code: "RENDER_FAILED", message: "The export helper lost this job (was it restarted?)." };
  return res.json();
}

export const exportDownloadUrl = (job) => (job?.download ? `${EXPORT_HELPER_URL}${job.download}` : null);

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
