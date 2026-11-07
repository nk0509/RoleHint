// Runs the real handlers and Google SDK against a local stand-in for the API, so no credit is spent.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { CERTS, CHECKED, RETIRED } from "../lib/certifications.js";

const REPORT = { profile: { name: "A" }, fit: { score: 70 }, market: [], pivots: [] };
let requests = [];
let reply;

const events = (text, status) => [
  { event_type: "interaction.created", interaction: { id: "i", status: "in_progress" } },
  { event_type: "step.start", index: 0, step: { type: "model_output" } },
  { event_type: "step.delta", index: 0, delta: { type: "text", text } },
  { event_type: "step.stop", index: 0 },
  { event_type: "interaction.completed", interaction: { id: "i", status, usage: { total_input_tokens: 10, total_output_tokens: 5, total_thought_tokens: 2 } } },
];

const fake = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  requests.push({ url: req.url, key: req.headers["x-goog-api-key"], body: JSON.parse(body) });
  if (reply.status) {
    res.writeHead(reply.status, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: reply.status, message: "nope", status: "ERROR" } }));
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const event of reply.events ?? events(reply.text, reply.finish)) res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.end();
});

let audit, certs, chat, letter;
const originalLog = console.log;
const originalError = console.error;
const printed = [];

before(async () => {
  await new Promise((done) => fake.listen(0, done));
  process.env.GOOGLE_GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.AUDITS_PER_VISITOR_PER_DAY = "3";
  process.env.LETTERS_PER_VISITOR_PER_DAY = "2";
  process.env.CERT_CHECKS_PER_VISITOR_PER_DAY = "2";
  delete process.env.GOOGLE_API_KEY;
  delete process.env.VERCEL_ENV;
  console.log = console.error = (...args) => printed.push(args.join(" "));
  audit = await import("../api/audit.js");
  chat = await import("../api/chat.js");
  letter = await import("../api/cover-letter.js");
  certs = await import("../api/certifications.js");
});

after(() => {
  console.log = originalLog;
  console.error = originalError;
  fake.close();
});

beforeEach(() => {
  requests = [];
  reply = { text: JSON.stringify(REPORT), finish: "completed" };
});

let ip = 0;
const SECRET_CV = "CANARY-CV-TEXT ".repeat(10);
const call = (handler, body, { headers, address } = {}) =>
  handler(new Request("http://site.test/api", {
    method: "POST",
    headers: { origin: "http://site.test", host: "site.test", "x-forwarded-for": address ?? `10.0.0.${++ip}`, ...headers },
    body: JSON.stringify(body),
  }));
const input = (extra) => ({ target: "Engineer", cv: SECRET_CV, strictness: "balanced", consent: true, ...extra });
const certInput = (extra) => ({ target: "Engineer", cv: SECRET_CV, consent: true, ...extra });
const lines = async (response) => (await response.text()).trim().split("\n").map((line) => JSON.parse(line));

test("a valid audit streams progress, then the parsed report", async () => {
  const response = await call(audit.POST, input());
  const all = await lines(response);
  assert.equal(response.status, 200);
  assert.ok(all.some((event) => event.type === "progress"));
  assert.deepEqual(all.at(-1), { type: "result", data: REPORT, remaining: 2 });
});

test("the request uses the default model, structured output and no storage", async () => {
  await lines(await call(audit.POST, input()));
  const [sent] = requests;
  assert.equal(sent.body.model, "gemini-3.8-flash");
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.stream, true);
  assert.equal(sent.body.response_format.mime_type, "application/json");
  assert.equal(sent.body.generation_config.thinking_level, "medium");
  assert.equal(sent.key, "test-key");
});

test("every AI request tells the AI today's date", async () => {
  const today = `<today>${new Date().toISOString().slice(0, 10)}</today>`;
  await lines(await call(audit.POST, input()));
  reply = { text: "Fix the top gap.", finish: "completed" };
  await lines(await call(chat.POST, { target: "Engineer", cv: SECRET_CV, audit: "{}", turns: [{ role: "user", content: "What first?" }] }));
  await lines(await call(letter.POST, { target: "Engineer", cv: SECRET_CV, tone: "formal", consent: true }));
  reply = { text: JSON.stringify({ summary: "Ok.", advice: [] }), finish: "completed" };
  await lines(await call(certs.POST, certInput()));
  assert.equal(requests.length, 4);
  for (const { body } of requests) assert.ok(JSON.stringify(body).includes(today));
});

test("CV text stays out of the logs", async () => {
  await lines(await call(audit.POST, input()));
  reply = { status: 400 };
  await lines(await call(audit.POST, input()));
  assert.ok(!printed.join("\n").includes("CANARY"));
});

test("each visitor is stopped at the daily limit", async () => {
  const address = "10.1.1.1";
  for (let i = 0; i < 3; i++) await lines(await call(audit.POST, input(), { address }));
  const blocked = await call(audit.POST, input(), { address });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { code: "limit_visitor" });
  assert.equal(requests.length, 3);
});

test("a failed audit doesn't use up an audit", async () => {
  const address = "10.1.1.2";
  reply = { status: 400 };
  const failed = await lines(await call(audit.POST, input(), { address }));
  assert.equal(failed.at(-1).code, "upstream");
  reply = { text: JSON.stringify(REPORT), finish: "completed" };
  const ok = await lines(await call(audit.POST, input(), { address }));
  assert.equal(ok.at(-1).remaining, 2);
});

test("incomplete, unparsable and failed answers report an error", async () => {
  reply = { text: '{"profile":', finish: "incomplete" };
  assert.equal((await lines(await call(audit.POST, input()))).at(-1).code, "truncated");
  reply = { text: '{"profile":', finish: "completed" };
  assert.equal((await lines(await call(audit.POST, input()))).at(-1).code, "truncated");
  reply = { text: "", finish: "failed" };
  assert.equal((await lines(await call(audit.POST, input()))).at(-1).code, "truncated");
  reply = { events: [{ event_type: "step.delta", index: 0, delta: { type: "text", text: "{" } }] };
  assert.equal((await lines(await call(audit.POST, input()))).at(-1).code, "truncated");
});

test("a rejected key or empty credit shows as unavailable", async () => {
  for (const status of [401, 402]) {
    reply = { status };
    assert.equal((await lines(await call(audit.POST, input()))).at(-1).code, "unavailable");
  }
});

test("bad requests are refused before any AI call", async () => {
  const cases = [
    [input({ consent: false }), {}, 400, "consent"],
    [input({ cv: "short" }), {}, 400, "too_short"],
    [input({ cv: "x".repeat(40_001) }), {}, 413, "too_long"],
    [input({ strictness: "nope" }), {}, 400, "bad_request"],
    [input(), { headers: { origin: "http://evil.test" } }, 403, "forbidden"],
  ];
  for (const [body, options, status, code] of cases) {
    const response = await call(audit.POST, body, options);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(requests.length, 0);
});

test("a deployed site without Redis refuses to spend", async () => {
  process.env.VERCEL_ENV = "production";
  try {
    const response = await call(audit.POST, input());
    assert.equal(response.status, 503);
    assert.equal(requests.length, 0);
  } finally {
    delete process.env.VERCEL_ENV;
  }
});

test("chat streams text and rejects malformed turns", async () => {
  reply = { text: "Fix the top gap.", finish: "completed" };
  const body = { target: "Engineer", cv: SECRET_CV, audit: "{}", turns: [{ role: "user", content: "What first?" }] };
  const all = await lines(await call(chat.POST, body));
  assert.deepEqual(all, [{ type: "text", text: "Fix the top gap." }, { type: "done" }]);
  const bad = await call(chat.POST, { ...body, turns: [{ role: "assistant", content: "hi" }] });
  assert.equal(bad.status, 400);
});

const letterInput = (extra) => ({ target: "Engineer", company: "Acme", cv: SECRET_CV, tone: "formal", consent: true, ...extra });

test("a cover letter streams text and uses no structured output or storage", async () => {
  reply = { text: "Dear [Hiring Manager's name],", finish: "completed" };
  const all = await lines(await call(letter.POST, letterInput()));
  assert.deepEqual(all, [{ type: "text", text: "Dear [Hiring Manager's name]," }, { type: "done", remaining: 1 }]);
  const [sent] = requests;
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.response_format, undefined);
  assert.equal(sent.body.generation_config.thinking_level, "low");
  assert.ok(JSON.stringify(sent.body.input).includes("<tone>formal</tone>"));
  assert.ok(!printed.join("\n").includes("CANARY"));
});

test("cover letters have their own daily limit", async () => {
  const address = "10.1.1.3";
  reply = { text: "Letter", finish: "completed" };
  for (let i = 0; i < 2; i++) await lines(await call(letter.POST, letterInput(), { address }));
  const blocked = await call(letter.POST, letterInput(), { address });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { code: "limit_visitor" });
  assert.equal(requests.length, 2);
  const auditAfter = await call(audit.POST, input(), { address });
  assert.equal(auditAfter.status, 200);
  await auditAfter.text();
});

test("a failed or cut-off letter doesn't use up a letter", async () => {
  const address = "10.1.1.4";
  reply = { status: 400 };
  assert.equal((await lines(await call(letter.POST, letterInput(), { address }))).at(-1).code, "upstream");
  reply = { text: "Dear", finish: "incomplete" };
  assert.equal((await lines(await call(letter.POST, letterInput(), { address }))).at(-1).code, "truncated");
  reply = { text: "Letter", finish: "completed" };
  assert.equal((await lines(await call(letter.POST, letterInput(), { address }))).at(-1).remaining, 1);
});

test("bad cover letter requests are refused before any AI call", async () => {
  const cases = [
    [letterInput({ consent: false }), {}, 400, "consent"],
    [letterInput({ cv: "short" }), {}, 400, "too_short"],
    [letterInput({ target: "" }), {}, 400, "bad_request"],
    [letterInput({ tone: "nope" }), {}, 400, "bad_request"],
    [letterInput({ company: "x".repeat(201) }), {}, 413, "too_long"],
    [letterInput(), { headers: { origin: "http://evil.test" } }, 403, "forbidden"],
  ];
  for (const [body, options, status, code] of cases) {
    const response = await call(letter.POST, body, options);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(requests.length, 0);
});

const AD = "Build models on Google Cloud. AWS Machine Learning Specialty or DP-100 preferred. Hiring an Azure Data Engineer.";
const advice = (extra) => ({ skill: "Cloud ML", why: "It helps.", adQuote: "", certId: "gcp-ml-engineer", cvLine: "Certified, [month year]", ...extra });
const planReply = (items) => ({ text: JSON.stringify({ summary: "Worth it.", advice: items }), finish: "completed" });

test("a certificate's details come from the checked list, not the AI", async () => {
  reply = planReply([advice({ cost: "$1", url: "https://bad.example" })]);
  const all = await lines(await call(certs.POST, certInput()));
  const { cert } = all.at(-1).data.advice[0];
  assert.equal(cert.cost, CERTS.find(({ id }) => id === "gcp-ml-engineer").cost);
  assert.ok(cert.url.startsWith("https://cloud.google.com/"));
  assert.equal(all.at(-1).remaining, 1);
});

test("a certificate that isn't on the list never reaches the page", async () => {
  reply = planReply([advice({ certId: "made-up-cert" }), advice({ certId: "ckad" })]);
  const all = await lines(await call(certs.POST, certInput()));
  assert.deepEqual(all.at(-1).data.advice.map(({ cert }) => cert.id), ["ckad"]);
});

test("a job ad quote is shown only if the ad really says it", async () => {
  reply = planReply([advice({ adQuote: "build  MODELS on google cloud" }), advice({ adQuote: "Must hold this certificate" })]);
  const { data } = (await lines(await call(certs.POST, certInput({ jobDescription: AD })))).at(-1);
  assert.deepEqual(data.advice.map(({ quote }) => Boolean(quote)), [true, false]);
  assert.equal(data.hasAd, true);
});

test("retired certificates are flagged, but a job title alone isn't", async () => {
  reply = planReply([]);
  const cv = `${SECRET_CV} Holds AI-102.`;
  const { data } = (await lines(await call(certs.POST, certInput({ jobDescription: AD, cv })))).at(-1);
  assert.deepEqual(data.retired.map(({ code, inAd, inCv }) => [code, inAd, inCv]), [["MLS-C01", true, false], ["DP-100", true, false], ["AI-102", false, true]]);
  assert.ok(data.retired[0].replacement.name.includes("Machine Learning Engineer"));
});

test("a plan can recommend no certificates, and never more than four", async () => {
  reply = planReply([]);
  const none = (await lines(await call(certs.POST, certInput()))).at(-1).data;
  assert.deepEqual([none.summary, none.advice], ["Worth it.", []]);
  reply = planReply(Array.from({ length: 6 }, () => advice()));
  assert.equal((await lines(await call(certs.POST, certInput()))).at(-1).data.advice.length, 4);
});

test("certificate checks have their own daily limit", async () => {
  const address = "10.2.0.1";
  reply = planReply([]);
  for (let used = 0; used < 2; used += 1) assert.equal((await call(certs.POST, certInput(), { address })).status, 200);
  const blocked = await call(certs.POST, certInput(), { address });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { code: "limit_visitor" });
});

test("a failed certificate check doesn't use up a check", async () => {
  const address = "10.2.0.2";
  reply = { status: 500 };
  await lines(await call(certs.POST, certInput(), { address }));
  reply = planReply([]);
  const all = await lines(await call(certs.POST, certInput(), { address }));
  assert.equal(all.at(-1).remaining, 1);
});

test("bad certificate requests are refused before any AI call", async () => {
  assert.equal((await call(certs.POST, certInput({ consent: false }))).status, 400);
  assert.equal((await call(certs.POST, certInput({ target: "" }))).status, 400);
  assert.equal((await call(certs.POST, certInput({ cv: "short" }))).status, 400);
  assert.equal(requests.length, 0);
});

test("the sample plan calls no AI", async () => {
  const sample = await certs.GET().json();
  assert.equal(sample.count, CERTS.length);
  assert.equal(sample.advice[0].cert.id, "gcp-ml-engineer");
  assert.equal(sample.retired[0].code, "MLS-C01");
  assert.equal(requests.length, 0);
});

test("the certificate list is complete and has nothing retired in it", () => {
  assert.equal(new Set(CERTS.map(({ id }) => id)).size, CERTS.length);
  assert.match(CHECKED, /^\d{4}-\d{2}$/);
  const retiredCodes = new Set(RETIRED.map(({ code }) => code));
  for (const cert of CERTS) {
    assert.ok(cert.url.startsWith("https://"), cert.id);
    assert.ok(cert.name && cert.provider && cert.level && cert.cost && cert.valid && cert.skills.length, cert.id);
    assert.ok(!retiredCodes.has(cert.code), cert.id);
  }
  for (const { replacedBy, match } of RETIRED) {
    assert.ok(CERTS.some(({ id }) => id === replacedBy), replacedBy);
    assert.ok(match.every((name) => name === name.toLowerCase()), replacedBy);
  }
});
