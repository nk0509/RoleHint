import { streamReply } from "./gemini.js";
import { AUDIT_SCHEMA, AUDIT_SYSTEM, auditMessage } from "./prompts.js";

// One CV check request to Gemini. The live site and the evaluation in eval/ both use this, so the evaluation measures exactly what visitors get.
export const requestAudit = (input, { signal, onText } = {}) =>
  streamReply({
    system: AUDIT_SYSTEM,
    input: auditMessage(input),
    schema: AUDIT_SCHEMA,
    thinking: "medium",
    maxTokens: 20_000,
    signal,
    onText,
  });
