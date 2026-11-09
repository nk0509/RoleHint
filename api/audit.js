import { requestAudit } from "../lib/audit.js";
import { errorCode, logUsage } from "../lib/gemini.js";
import { clean, json, readBody, reserve, Stop, verifyCaptcha } from "../lib/guard.js";
import { MOCK_AUDIT, mockEnabled } from "../lib/mock.js";
import { eventStream } from "../lib/stream.js";

const STRICTNESS = new Set(["supportive", "balanced", "harsh"]);

function parseInput(body) {
  const input = {
    target: clean(body.target, 200),
    level: clean(body.level, 60),
    location: clean(body.location, 120),
    jobDescription: clean(body.jobDescription, 12_000),
    cv: clean(body.cv, 40_000),
    strictness: body.strictness,
  };
  if (!input.target || !STRICTNESS.has(input.strictness)) throw new Stop(400, "bad_request");
  if (input.cv.length < 100) throw new Stop(400, "too_short");
  if (body.consent !== true) throw new Stop(400, "consent");
  return input;
}

export async function POST(request) {
  let input, slot;
  try {
    const body = await readBody(request);
    input = parseInput(body);
    await verifyCaptcha(body.captcha, request);
    slot = await reserve(request, "audit");
  } catch (error) {
    if (error instanceof Stop) return json(error.status, { code: error.code });
    throw error;
  }

  return eventStream(async (send, onAbort) => {
    if (mockEnabled()) {
      send({ type: "progress", chars: 1 });
      send({ type: "result", data: MOCK_AUDIT, remaining: slot.remaining });
      return;
    }
    const controller = new AbortController();
    onAbort(() => {
      controller.abort();
      slot.release();
    });
    try {
      const reply = await requestAudit(input, {
        signal: controller.signal,
        onText: (_, chars) => send({ type: "progress", chars }),
      });
      logUsage("audit", reply);
      if (reply.status !== "completed") {
        await slot.release();
        send({ type: "error", code: "truncated" });
        return;
      }
      send({ type: "result", data: JSON.parse(reply.text), remaining: slot.remaining });
    } catch (error) {
      if (controller.signal.aborted) return;
      await slot.release();
      send({ type: "error", code: error instanceof SyntaxError ? "truncated" : errorCode(error) });
    }
  });
}
