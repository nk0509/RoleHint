/* The comparison point: what a person gets by pasting their CV into an AI chat with a simple prompt.
   Same model and thinking level as RoleHint, but none of RoleHint's rules, tags or date. It still answers in JSON so it can be scored the same way. */
import { streamReply } from "../lib/gemini.js";

const string = { type: "string" };

const SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    missingSkills: { type: "array", items: string },
    strengths: { type: "array", items: string },
  },
  required: ["score", "missingSkills", "strengths"],
  additionalProperties: false,
};

const SYSTEM = "You are a recruiter. Read the CV and the job description, rate how well the candidate fits the job from 0 to 100, and list the skills the job needs that the CV is missing.";

export const requestBaseline = ({ target, jobDescription, cv }) =>
  streamReply({
    system: SYSTEM,
    input: `Job title: ${target}\n\nJob description:\n${jobDescription}\n\nCV:\n${cv}`,
    schema: SCHEMA,
    thinking: "medium",
    maxTokens: 8_000,
  });
