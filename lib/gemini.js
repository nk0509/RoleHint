import { GoogleGenAI } from "@google/genai";

const model = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

let client;

// Streams one reply. store: false stops Google saving the interaction for later retrieval.
export async function streamReply({ system, input, schema, thinking, maxTokens, onText, signal }) {
  client ??= new GoogleGenAI({});
  const name = model();
  const stream = await client.interactions.create(
    {
      model: name,
      input,
      system_instruction: system,
      store: false,
      stream: true,
      generation_config: { thinking_level: thinking, max_output_tokens: maxTokens },
      ...(schema ? { response_format: { type: "text", mime_type: "application/json", schema } } : {}),
    },
    { signal },
  );
  let text = "";
  let status = "incomplete";
  let usage = {};
  for await (const event of stream) {
    if (event.event_type === "step.delta" && event.delta?.type === "text") {
      text += event.delta.text;
      onText?.(event.delta.text, text.length);
    }
    if (event.event_type === "interaction.completed") {
      status = event.interaction.status ?? "completed";
      usage = event.interaction.usage ?? {};
    }
    if (event.event_type === "error") throw Object.assign(new Error("Stream error"), { status: Number(event.error?.code) || 500 });
  }
  return { text, status, model: name, usage };
}

export function logUsage(route, reply) {
  const { total_input_tokens, total_output_tokens, total_thought_tokens } = reply.usage;
  console.log(JSON.stringify({ route, model: reply.model, total_input_tokens, total_output_tokens, total_thought_tokens, status: reply.status }));
}

// Maps API failures to codes the page can explain. Keys and CV text never reach the browser or logs.
export function errorCode(error) {
  console.error(JSON.stringify({ apiError: error?.status, name: error?.name }));
  if (error?.status === 429) return "busy";
  return [401, 402, 403].includes(error?.status) ? "unavailable" : "upstream";
}
