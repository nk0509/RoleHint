import { createHash } from "node:crypto";

const MAX_BODY = 120_000;
const DAY_SECONDS = 86_400;
const memory = new Map();

export class Stop extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const isDeployed = () => Boolean(process.env.VERCEL_ENV);

const setting = (name, fallback) => {
  const value = process.env[name];
  const number = Number(value);
  return value && Number.isFinite(number) && number >= 0 ? number : fallback;
};

// The site-wide totals cap the worst day's AI bill. Raise them in Vercel's settings when there's more credit.
export const limits = () => ({
  audit: { visitor: setting("AUDITS_PER_VISITOR_PER_DAY", 2), total: setting("AUDITS_PER_DAY_TOTAL", 15) },
  chat: { visitor: setting("CHATS_PER_VISITOR_PER_DAY", 15), total: setting("CHATS_PER_DAY_TOTAL", 50) },
  letter: { visitor: setting("LETTERS_PER_VISITOR_PER_DAY", 3), total: setting("LETTERS_PER_DAY_TOTAL", 15) },
  cert: { visitor: setting("CERT_CHECKS_PER_VISITOR_PER_DAY", 3), total: setting("CERT_CHECKS_PER_DAY_TOTAL", 15) },
});

export async function readBody(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let sameSite = false;
  try {
    sameSite = new URL(origin).host === host;
  } catch {}
  if (!sameSite) throw new Stop(403, "forbidden");
  if (Number(request.headers.get("content-length")) > MAX_BODY) throw new Stop(413, "too_long");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Stop(413, "too_long");
  try {
    return JSON.parse(text);
  } catch {
    throw new Stop(400, "bad_request");
  }
}

export const clean = (value, max) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Stop(400, "bad_request");
  const text = value.trim();
  if (text.length > max) throw new Stop(413, "too_long");
  return text;
};

const redis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
};

// Counters must be shared across server instances to hold, so a deployed site without Redis refuses to spend.
async function add(keys, amount) {
  const store = redis();
  if (!store) {
    if (isDeployed()) {
      console.error("Redis is not configured, so requests are refused.");
      throw new Stop(503, "unavailable");
    }
    return keys.map((key) => {
      const count = (memory.get(key) ?? 0) + amount;
      memory.set(key, count);
      return count;
    });
  }
  const commands = keys.flatMap((key) => [["INCRBY", key, amount], ["EXPIRE", key, DAY_SECONDS * 2]]);
  let replies;
  try {
    const response = await fetch(`${store.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${store.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!response.ok) throw new Error(String(response.status));
    replies = await response.json();
  } catch (error) {
    console.error(`Redis request failed: ${error.message}`);
    throw new Stop(503, "unavailable");
  }
  return keys.map((_, index) => Number(replies[index * 2].result));
}

function visitor(request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "local";
  const ip = forwarded.split(",")[0].trim();
  const salt = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "local";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 24);
}

// Reserves one use for this visitor and the whole site. Call release() if the request fails.
export async function reserve(request, route) {
  const day = new Date().toISOString().slice(0, 10);
  const keys = [`use:${route}:${day}:${visitor(request)}`, `use:${route}:${day}:total`];
  const [mine, total] = await add(keys, 1);
  const cap = limits()[route];
  const release = () => add(keys, -1).catch(() => {});
  if (mine > cap.visitor) {
    await release();
    throw new Stop(429, "limit_visitor");
  }
  if (total > cap.total) {
    await release();
    throw new Stop(429, "limit_site");
  }
  return { release, remaining: cap.visitor - mine };
}

export async function verifyCaptcha(token, request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (typeof token !== "string" || !token) throw new Stop(400, "captcha");
  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: request.headers.get("x-vercel-forwarded-for") ?? undefined }),
    });
    result = await response.json();
  } catch {
    throw new Stop(503, "unavailable");
  }
  if (!result.success) throw new Stop(400, "captcha");
}
