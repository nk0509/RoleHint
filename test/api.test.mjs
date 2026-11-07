// Runs the real handlers and Google SDK against a local stand-in for the API, so no credit is spent.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";

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

let audit, chat;
const originalLog = console.log;
const originalError = console.error;
const printed = [];

before(async () => {
  await new Promise((done) => fake.listen(0, done));
  process.env.GOOGLE_GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.AUDITS_PER_VISITOR_PER_DAY = "3";
  delete process.env.GOOGLE_API_KEY;
  delete process.env.VERCEL_ENV;
  console.log = console.error = (...args) => printed.push(args.join(" "));
  audit = await import("../api/audit.js");
  chat = await import("../api/chat.js");
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
