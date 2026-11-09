/* Runs RoleHint's CV check on every case in eval/cases and writes a report to eval/results.

   npm run eval                    real AI, asks before spending
   npm run eval -- --mock          fake answers, free, checks that the pipeline works

   Options: --runs 3      how many times to run each case
            --baseline    also run the plain-prompt comparison
            --only a,b    run only these case ids
            --parallel 2  how many requests at once
            --yes         skip the cost question
            --from file   re-score a saved -raw.json file with the current rules, free */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";
import { requestAudit } from "../lib/audit.js";
import { MOCK_AUDIT } from "../lib/mock.js";
import { requestBaseline } from "./baseline.mjs";
import { baselineAsReport, checkReport, grounding, RUPEES_PER_DOLLAR, summarise } from "./metrics.mjs";
import { renderReport } from "./report.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const mock = flag("mock");
const runsEach = Math.max(1, Number(option("runs", 3)));
const parallel = Math.max(1, Number(option("parallel", 2)));
const only = option("only", "").split(",").filter(Boolean);

// Real cases with people's CVs go in eval/cases/private, which git ignores.
function loadCases() {
  const folders = ["eval/cases", "eval/cases/private"].filter(existsSync);
  const cases = folders.flatMap((folder) =>
    readdirSync(folder)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(folder, file), "utf8"))),
  );
  return only.length ? cases.filter((c) => only.includes(c.id)) : cases;
}

async function confirm(calls) {
  // Rough averages from real runs: a CV check costs about $0.014 and a plain-prompt run far less.
  const usd = calls.audits * 0.014 + calls.baseline * 0.004;
  console.log(`This makes ${calls.audits + calls.baseline} real AI requests, roughly ₹${Math.ceil(usd * RUPEES_PER_DOLLAR)} of Gemini credit.`);
  if (flag("yes")) return true;
  if (!process.stdin.isTTY) {
    console.log("Add --yes to run without being asked.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Type yes to continue: ");
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

// A dropped connection or a busy server isn't RoleHint's fault, so those are tried again before counting as a failure.
const TRANSIENT = /fetch failed|terminated|ECONNRESET|ETIMEDOUT|socket|network/i;
const isTransient = (error) => TRANSIENT.test(error?.message ?? "") || [429, 500, 502, 503, 504].includes(error?.status);

async function withRetries(attempt, tries = 3) {
  for (let i = 1; ; i += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= tries || !isTransient(error)) throw error;
      console.log(`  retry after: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * i));
    }
  }
}

async function runOne(kase, system, run) {
  const started = Date.now();
  const base = { caseId: kase.id, system, run };
  try {
    let report, usage = {};
    if (mock) {
      report = system === "rolehint" ? structuredClone(MOCK_AUDIT) : baselineAsReport({ score: 50, missingSkills: ["Mock skill"], strengths: [] });
    } else {
      const input = { level: "", location: "", strictness: "balanced", ...kase.input };
      const reply = await withRetries(() => (system === "rolehint" ? requestAudit(input) : requestBaseline(input)));
      usage = reply.usage;
      if (reply.status !== "completed") throw new Error(`the answer was cut off (${reply.status})`);
      const answer = JSON.parse(reply.text);
      report = system === "rolehint" ? answer : baselineAsReport(answer);
    }
    const result = {
      ...base,
      ok: true,
      score: report.fit?.score,
      checks: checkReport(report, kase.expect),
      grounding: system === "rolehint" ? grounding(report, kase.input.cv) : null,
      ms: Date.now() - started,
      usage,
      report,
    };
    const passed = result.checks.filter((c) => c.pass).length;
    console.log(`  done  ${kase.id} · ${system} · run ${run} · score ${result.score} · ${passed}/${result.checks.length} checks · ${Math.round(result.ms / 1000)} s`);
    return result;
  } catch (error) {
    console.log(`  fail  ${kase.id} · ${system} · run ${run} · ${error.message}`);
    return { ...base, ok: false, error: error.message, checks: [], ms: Date.now() - started, usage: {} };
  }
}

async function inBatches(tasks, size) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next++;
        results[index] = await tasks[index]();
      }
    }),
  );
  return results;
}

// Scores saved answers again with the current rules. No AI is called, so it's free.
function rescore(file) {
  const saved = JSON.parse(readFileSync(file, "utf8"));
  const cases = new Map(loadCases().map((kase) => [kase.id, kase]));
  const runs = saved.runs.map((run) => {
    const kase = cases.get(run.caseId);
    if (run.system === "roleproof") run = { ...run, system: "rolehint" };
    if (!run.ok || !kase) return run;
    const report = run.system === "baseline" ? baselineAsReport({ score: run.report.fit.score, missingSkills: run.report.fit.gaps.map((g) => g.gap) }) : run.report;
    return { ...run, report, checks: checkReport(report, kase.expect), grounding: run.system === "rolehint" ? grounding(report, kase.input.cv) : null };
  });
  const used = [...cases.values()].filter((kase) => runs.some((run) => run.caseId === kase.id));
  const markdown = renderReport(summarise(runs, used), saved.meta);
  const target = file.replace(/-raw\.json$/, "-summary.md");
  writeFileSync(target, markdown);
  writeFileSync("eval/results/latest-summary.md", markdown);
  console.log(`Re-scored ${runs.length} saved runs. Report: ${target}`);
}

async function main() {
  const from = option("from", "");
  if (from) return rescore(from);
  if (!mock && existsSync(".env.local")) Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
  if (!mock && !process.env.GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY found. Run npm run setkey first, or add --mock for a free practice run.");
    process.exit(1);
  }

  const cases = loadCases();
  if (!cases.length) {
    console.log("No cases found in eval/cases.");
    process.exit(1);
  }
  const systems = flag("baseline") ? ["rolehint", "baseline"] : ["rolehint"];
  const calls = { audits: cases.length * runsEach, baseline: systems.includes("baseline") ? cases.length * runsEach : 0 };
  if (!mock && !(await confirm(calls))) {
    console.log("Nothing was run.");
    return;
  }

  console.log(`Running ${cases.length} cases, ${runsEach} times each${mock ? " with mock answers" : ""}…`);
  const tasks = cases.flatMap((kase) => systems.flatMap((system) => Array.from({ length: runsEach }, (_, i) => () => runOne(kase, system, i + 1))));
  const runs = await inBatches(tasks, parallel);

  const summary = summarise(runs, cases);
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const meta = { date, cases: cases.length, runs: runsEach, model: process.env.GEMINI_MODEL || "gemini-3.8-flash", mock };
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  mkdirSync("eval/results", { recursive: true });
  // The raw file holds full reports, which can quote CVs, so git ignores it. The summary holds only scores and checks.
  writeFileSync(`eval/results/${stamp}-raw.json`, `${JSON.stringify({ meta, runs }, null, 2)}\n`);
  writeFileSync(`eval/results/${stamp}-summary.md`, renderReport(summary, meta));
  writeFileSync("eval/results/latest-summary.md", renderReport(summary, meta));

  const r = summary.rolehint;
  console.log(`\nChecks passed: ${Math.round((r.checksPassed ?? 0) * 100)}% · average score spread: ${r.averageSpread?.toFixed(1) ?? "–"} · invented numbers: ${r.inventedNumbers ?? "–"}`);
  console.log(`Report: eval/results/${stamp}-summary.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
