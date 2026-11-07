import { json, limits } from "../lib/guard.js";

export function GET() {
  return json(200, { auditsPerDay: limits().audit.visitor, turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null });
}
