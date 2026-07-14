const { createClient } = require("@supabase/supabase-js");

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SPORTS = new Set(["kickball", "flag_football"]);
const EXPERIENCE_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);
const AVAILABILITY = new Set(["sunday_morning", "sunday_night", "monday_night"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class IntakeError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function requiredString(value, label, max) {
  if (typeof value !== "string" || !value.trim()) throw new IntakeError(400, `${label} is required.`);
  const clean = value.trim();
  if (clean.length > max) throw new IntakeError(400, `${label} is too long.`);
  return clean;
}

function optionalString(value, label, max) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new IntakeError(400, `${label} is invalid.`);
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length > max) throw new IntakeError(400, `${label} is too long.`);
  return clean;
}

function email(value, label = "Email") {
  const clean = optionalString(value, label, 254);
  if (clean && !EMAIL.test(clean)) throw new IntakeError(400, `${label} is invalid.`);
  return clean;
}

function oneOf(value, allowed, label) {
  if (!allowed.has(value)) throw new IntakeError(400, `${label} is invalid.`);
  return value;
}

function stringArray(value, allowed, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems || new Set(value).size !== value.length) {
    throw new IntakeError(400, `${label} is invalid.`);
  }
  if (value.some((entry) => typeof entry !== "string" || !allowed.has(entry))) {
    throw new IntakeError(400, `${label} is invalid.`);
  }
  return value;
}

function requireContact(phone, contactEmail) {
  if (!phone && !contactEmail) throw new IntakeError(400, "Phone or email is required.");
}

function validateTeamRegistration(payload) {
  const captainPhone = optionalString(payload.captain_phone, "Captain phone", 40);
  const captainEmail = email(payload.captain_email, "Captain email");
  requireContact(captainPhone, captainEmail);

  let rosterSize = null;
  if (payload.estimated_roster_size != null && payload.estimated_roster_size !== "") {
    rosterSize = Number(payload.estimated_roster_size);
    if (!Number.isInteger(rosterSize) || rosterSize < 1 || rosterSize > 30) {
      throw new IntakeError(400, "Estimated roster size must be between 1 and 30.");
    }
  }
  if (payload.consent_to_contact !== true) throw new IntakeError(400, "Contact consent is required.");

  return {
    captain_name: requiredString(payload.captain_name, "Captain name", 120),
    captain_phone: captainPhone,
    captain_email: captainEmail,
    sport: oneOf(payload.sport, SPORTS, "Sport"),
    team_name: requiredString(payload.team_name, "Team name", 120),
    estimated_roster_size: rosterSize,
    preferred_season: requiredString(payload.preferred_season, "Preferred season", 80),
    consent_to_contact: true,
    notes: optionalString(payload.notes, "Notes", 2000),
  };
}

function validateFreeAgent(payload) {
  const phone = optionalString(payload.phone, "Phone", 40);
  const contactEmail = email(payload.email);
  requireContact(phone, contactEmail);
  if (payload.consent_to_contact !== true) throw new IntakeError(400, "Contact consent is required.");

  const experience = optionalString(payload.experience, "Experience", 40);
  if (experience && !EXPERIENCE_LEVELS.has(experience)) throw new IntakeError(400, "Experience is invalid.");

  const sports = stringArray(payload.sports, SPORTS, "Sports", 2);
  if (!sports.length) throw new IntakeError(400, "Select at least one sport.");

  return {
    first_name: requiredString(payload.first_name, "First name", 80),
    last_name: requiredString(payload.last_name, "Last name", 80),
    display_name: optionalString(payload.display_name, "Display name", 80),
    email: contactEmail,
    phone,
    sports,
    experience,
    preferred_position: optionalString(payload.preferred_position, "Preferred position", 80),
    availability: stringArray(payload.availability || [], AVAILABILITY, "Availability", 3),
    emergency_contact_name: optionalString(payload.emergency_contact_name, "Emergency contact name", 120),
    emergency_contact_phone: optionalString(payload.emergency_contact_phone, "Emergency contact phone", 40),
    consent_to_contact: true,
    notes: optionalString(payload.notes, "Notes", 2000),
  };
}

function parseBody(body) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      throw new IntakeError(400, "Request body must be valid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new IntakeError(400, "Request body must be valid JSON.");
  return body;
}

function readConfig(env = process.env) {
  const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "TURNSTILE_SECRET_KEY", "TURNSTILE_ALLOWED_HOSTNAMES"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new IntakeError(503, "Intake is temporarily unavailable.");
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    allowedHostnames: new Set(env.TURNSTILE_ALLOWED_HOSTNAMES.split(",").map((value) => value.trim()).filter(Boolean)),
  };
}

async function verifyTurnstile({ token, action, remoteIp, config, fetchImpl = fetch }) {
  if (typeof token !== "string" || !token || token.length > 2048) throw new IntakeError(400, "Human verification is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const body = new URLSearchParams({ secret: config.turnstileSecretKey, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new IntakeError(503, "Human verification is temporarily unavailable.");
    const result = await response.json();
    if (!result.success || result.action !== action || !config.allowedHostnames.has(result.hostname)) {
      throw new IntakeError(403, "Human verification failed. Please try again.");
    }
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    throw new IntakeError(503, "Human verification is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

function serverClient(config) {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(req.body);
    const type = oneOf(body.type, new Set(["team_registration", "free_agent"]), "Intake type");
    if (body.website) throw new IntakeError(403, "Submission rejected.");
    const row = type === "team_registration" ? validateTeamRegistration(body.payload || {}) : validateFreeAgent(body.payload || {});
    const config = readConfig();
    const remoteIp = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

    await verifyTurnstile({ token: body.turnstile_token, action: type, remoteIp, config });
    const table = type === "team_registration" ? "team_registrations" : "free_agents";
    const { error } = await serverClient(config).from(table).insert(row);
    if (error) throw new Error(`Supabase insert failed (${error.code || "unknown"}).`);
    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof IntakeError) return res.status(error.status).json({ error: error.publicMessage });
    console.error("Public intake failed without exposing request data.", error?.message || error);
    return res.status(500).json({ error: "Submission could not be saved. Please try again." });
  }
}

module.exports = handler;
module.exports._test = {
  IntakeError,
  parseBody,
  readConfig,
  validateFreeAgent,
  validateTeamRegistration,
  verifyTurnstile,
};
