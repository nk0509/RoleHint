import { errorCode, logUsage, streamReply } from "../lib/gemini.js";
import { clean, json, readBody, reserve, Stop, verifyCaptcha } from "../lib/guard.js";
import { MOCK_LETTER, mockEnabled } from "../lib/mock.js";
import { LETTER_SYSTEM, letterMessage } from "../lib/prompts.js";
import { eventStream } from "../lib/stream.js";

const TONES = new Set(["formal", "friendly", "confident"]);

function parseInput(body) {
  const input = {
    target: clean(body.target, 200),
    company: clean(body.company, 200),
    jobDescription: clean(body.jobDescription, 12_000),
    cv: clean(body.cv, 40_000),
    tone: body.tone,
  };
  if (!input.target || !TONES.has(input.tone)) throw new Stop(400, "bad_request");
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
    slot = await reserve(request, "letter");
  } catch (error) {
    if (error instanceof Stop) return json(error.status, { code: error.code });
    throw error;
  }

  return eventStream(async (send, onAbort) => {
    if (mockEnabled()) {
      send({ type: "text", text: MOCK_LETTER });
      send({ type: "done", remaining: slot.remaining });
      return;
    }
    const controller = new AbortController();
    onAbort(() => {
      controller.abort();
      slot.release();
    });
    try {
      const reply = await streamReply({
        system: LETTER_SYSTEM,
        input: letterMessage(input),
        thinking: "low",
        maxTokens: 6_000,
        signal: controller.signal,
        onText: (text) => send({ type: "text", text }),
      });
      logUsage("cover-letter", reply);
      if (reply.status !== "completed") {
        await slot.release();
        send({ type: "error", code: "truncated" });
        return;
      }
      send({ type: "done", remaining: slot.remaining });
    } catch (error) {
      if (controller.signal.aborted) return;
      await slot.release();
      send({ type: "error", code: errorCode(error) });
    }
  });
}
