const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const required = [
  "REACT_APP_SUPABASE_URL",
  "REACT_APP_SUPABASE_ANON_KEY",
  "REACT_APP_TURNSTILE_SITE_KEY",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Production build blocked: missing ${missing.join(", ")}.`);
  process.exit(1);
}

console.log("Production public environment preflight passed (values not printed).");
