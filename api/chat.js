import { errorCode, logUsage, streamReply } from "../lib/gemini.js";
import { clean, json, readBody, reserve, Stop } from "../lib/guard.js";
import { mockEnabled } from "../lib/mock.js";
import { chatMessage, chatSystem } from "../lib/prompts.js";
import { eventStream } from "../lib/stream.js";

function parseInput(body) {
  const turns = body.turns;
  if (!Array.isArray(turns) || turns.length === 0 || turns.length > 11) throw new Stop(400, "bad_request");
  const messages = turns.map((turn, index) => {
    if (turn?.role !== (index % 2 === 0 ? "user" : "assistant")) throw new Stop(400, "bad_request");
    const content = clean(turn.content, 6_000);
    if (!content) throw new Stop(400, "bad_request");
    return { role: turn.role, content };
  });
  if (messages.at(-1).role !== "user") throw new Stop(400, "bad_request");
  return {
    target: clean(body.target, 200),
    cv: clean(body.cv, 40_000),
    audit: clean(body.audit, 8_000),
    messages,
  };
}

export async function POST(request) {
  let input, slot;
  try {
    input = parseInput(await readBody(request));
    slot = await reserve(request, "chat");
  } catch (error) {
    if (error instanceof Stop) return json(error.status, { code: error.code });
    throw error;
  }

  return eventStream(async (send, onAbort) => {
    if (mockEnabled()) {
      send({ type: "text", text: "This is a mock answer from local mode." });
      send({ type: "done" });
      return;
    }
    const controller = new AbortController();
    onAbort(() => {
      controller.abort();
      slot.release();
    });
    try {
      const reply = await streamReply({
        system: chatSystem(input),
        input: chatMessage(input.messages),
        thinking: "low",
        maxTokens: 4_000,
        signal: controller.signal,
        onText: (text) => send({ type: "text", text }),
      });
      logUsage("chat", reply);
      send(reply.status === "completed" ? { type: "done" } : { type: "error", code: "truncated" });
    } catch (error) {
      if (controller.signal.aborted) return;
      await slot.release();
      send({ type: "error", code: errorCode(error) });
    }
  });
}
