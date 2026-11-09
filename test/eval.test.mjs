// Checks the evaluation's scoring rules and test cases. No AI is called.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { MOCK_AUDIT } from "../lib/mock.js";
import { baselineAsReport, checkReport, costUsd, factsSupported, grounding, inventedNumbers, mentions, spearman, spread, summarise, supportedBy } from "../eval/metrics.mjs";
import { renderReport } from "../eval/report.mjs";

const cases = readdirSync("eval/cases")
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(`eval/cases/${file}`, "utf8")));

test("skill names match whole words, and * matches any ending", () => {
  assert.equal(mentions("Needs SQL for reporting", [["sql"]][0]), true);
  assert.equal(mentions("Uses MySQL daily", ["sql"]), false);
  assert.equal(mentions("No quantified results", ["quantif*"]), true);
  assert.equal(mentions("Deployed on K8s", ["kubernetes", "k8s"]), true);
});

test("invented numbers are caught, while [blanks] and the CV's own numbers are allowed", () => {
  const cv = "Cut costs by 18% across 5 million transactions";
  assert.deepEqual(inventedNumbers("Cut costs by 18% across 5 million transactions", [cv]), []);
  assert.deepEqual(inventedNumbers("Cut costs by [X%], saving 3,000 hours", [cv]), ["3000"]);
  assert.deepEqual(inventedNumbers("Raised revenue by [X] for 4 clients", [cv, "Worked with 4 clients"]), []);
});

test("evidence counts as supported only when the CV backs it", () => {
  const cv = "Deployed models as Docker containers on Kubernetes, serving 3,000 requests a second.";
  assert.deepEqual(supportedBy("Docker containers on Kubernetes", cv), { exact: true, supported: true });
  assert.equal(supportedBy("Deployed Docker models on Kubernetes clusters", cv).supported, true);
  assert.equal(supportedBy("Led a team of twelve designers at Google", cv).supported, false);
});

test("statistics behave on simple inputs", () => {
  assert.equal(spread([70, 74, 72]), 4);
  assert.equal(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1);
  assert.equal(spearman([1, 2, 3], [1, 2, 3]), null);
  assert.ok(Math.abs(costUsd({ total_input_tokens: 1_000_000 }) - 0.75) < 1e-9);
});

test("a report is checked against what the case expects", () => {
  const report = { fit: { score: 60, verdict: "", breakdown: { seniority: 30 }, gaps: [{ gap: "No SQL", fix: "Learn SQL" }], missingKeywords: ["Kubernetes"], strong: [], rewrites: [] } };
  const checks = checkReport(report, {
    missing: [["sql"]],
    notMissing: [["python"]],
    notAGap: [["kubernetes"]],
    score: { min: 50, max: 70 },
    breakdownMax: { seniority: 40 },
    forbidden: ["future date"],
  });
  assert.equal(checks.length, 7);
  assert.ok(checks.every((c) => c.pass), JSON.stringify(checks.filter((c) => !c.pass)));
  assert.equal(checkReport(report, { notMissing: [["kubernetes"]] })[0].pass, false);
});

test("the plain-prompt baseline is scored the same way, so it can't tell keywords from skills", () => {
  const report = baselineAsReport({ score: 40, missingSkills: ["Kubernetes"], strengths: [] });
  assert.equal(checkReport(report, { notAGap: [["kubernetes"]] })[0].pass, false);
});

test("every case is complete and has a unique id", () => {
  assert.ok(cases.length >= 10);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    assert.ok(c.about && c.input?.target && c.input?.jobDescription && c.input?.cv, c.id);
    assert.ok(Object.keys(c.expect ?? {}).length, `${c.id} has no expectations`);
    assert.ok(Array.isArray(c.human), c.id);
  }
});

test("a mock run summarises and renders without any CV text", () => {
  const kase = cases.find((c) => c.id === "strong-match");
  const runs = [1, 2].map((run) => ({ caseId: kase.id, system: "rolehint", run, ok: true, score: MOCK_AUDIT.fit.score, checks: checkReport(MOCK_AUDIT, kase.expect), grounding: grounding(MOCK_AUDIT, kase.input.cv), ms: 1000, usage: {} }));
  const summary = summarise(runs, [kase]);
  assert.equal(summary.rolehint.perCase[0].spread, 0);
  const markdown = renderReport(summary, { date: "2026-11-08", cases: 1, runs: 2, model: "test", mock: true });
  assert.ok(markdown.includes("strong-match"));
  assert.ok(!markdown.includes("Priya"));
});

test("metric names such as p99 aren't counted as numbers", () => {
  assert.deepEqual(inventedNumbers("Served 3,000 requests a second at [X] ms p99 latency", ["serving 3,000 requests a second"]), []);
});

test("asking for more depth isn't a false alarm, but calling a skill absent is", () => {
  const depth = { fit: { score: 60, gaps: [{ gap: "Lack of detail on data modelling in Power BI", fix: "" }], missingKeywords: ["DAX"] } };
  const absent = { fit: { score: 60, gaps: [{ gap: "No Power BI experience", fix: "" }], missingKeywords: [] } };
  assert.equal(checkReport(depth, { notMissing: [["power bi"]] })[0].pass, true);
  assert.equal(checkReport(absent, { notMissing: [["power bi"]] })[0].pass, false);
});

test("evidence facts are checked, while added opinion is ignored", () => {
  const cv = "M.Sc in Mathematics, University of Madras, 2020";
  assert.equal(factsSupported("Holds an M.Sc in Mathematics from University of Madras (2020), giving strong numeracy", cv), true);
  assert.equal(factsSupported("Holds an M.Sc in Statistics from Stanford University", cv), false);
  assert.equal(factsSupported("shows real promise", cv), null);
});

test("sub-score checks don't count against an answer that has no sub-scores", () => {
  const report = baselineAsReport({ score: 20, missingSkills: [], strengths: [] });
  assert.deepEqual(checkReport(report, { breakdownMax: { seniority: 40 } }), []);
});
