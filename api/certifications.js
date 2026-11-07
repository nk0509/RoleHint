import { buildPlan, example } from "../lib/certifications.js";
import { errorCode, logUsage, streamReply } from "../lib/gemini.js";
import { clean, json, readBody, reserve, Stop, verifyCaptcha } from "../lib/guard.js";
import { MOCK_PLAN, mockEnabled } from "../lib/mock.js";
import { CERT_SCHEMA, CERT_SYSTEM, certMessage } from "../lib/prompts.js";
import { eventStream } from "../lib/stream.js";

function parseInput(body) {
  const input = {
    target: clean(body.target, 200),
    jobDescription: clean(body.jobDescription, 12_000),
    cv: clean(body.cv, 40_000),
  };
  if (!input.target) throw new Stop(400, "bad_request");
  if (input.cv.length < 100) throw new Stop(400, "too_short");
  if (body.consent !== true) throw new Stop(400, "consent");
  return input;
}

// The sample plan on the page. No AI is called.
export function GET() {
  return json(200, example());
}

export async function POST(request) {
  let input, slot;
  try {
    const body = await readBody(request);
    input = parseInput(body);
    await verifyCaptcha(body.captcha, request);
    slot = await reserve(request, "cert");
  } catch (error) {
    if (error instanceof Stop) return json(error.status, { code: error.code });
    throw error;
  }

  return eventStream(async (send, onAbort) => {
    if (mockEnabled()) {
      send({ type: "progress", chars: 1 });
      send({ type: "result", data: buildPlan(MOCK_PLAN, input), remaining: slot.remaining });
      return;
    }
    const controller = new AbortController();
    onAbort(() => {
      controller.abort();
      slot.release();
    });
    try {
      const reply = await streamReply({
        system: CERT_SYSTEM,
        input: certMessage(input),
        schema: CERT_SCHEMA,
        thinking: "medium",
        maxTokens: 8_000,
        signal: controller.signal,
        onText: (_, chars) => send({ type: "progress", chars }),
      });
      logUsage("certifications", reply);
      if (reply.status !== "completed") {
        await slot.release();
        send({ type: "error", code: "truncated" });
        return;
      }
      send({ type: "result", data: buildPlan(JSON.parse(reply.text), input), remaining: slot.remaining });
    } catch (error) {
      if (controller.signal.aborted) return;
      await slot.release();
      send({ type: "error", code: error instanceof SyntaxError ? "truncated" : errorCode(error) });
    }
  });
}
