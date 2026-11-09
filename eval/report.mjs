/* Turns the summary into a Markdown report. It contains scores and pass or fail results only, never CV text, so it's safe to share. */
import { RUPEES_PER_DOLLAR } from "./metrics.mjs";

const pct = (value) => (value === null || value === undefined ? "–" : `${Math.round(value * 100)}%`);
const num = (value, digits = 1) => (value === null || value === undefined ? "–" : value.toFixed(digits));
const money = (usd) => `$${usd.toFixed(3)} (about ₹${(usd * RUPEES_PER_DOLLAR).toFixed(0)})`;

const ROWS = [
  ["Runs that finished", (s) => `${s.runs - s.failures} of ${s.runs}`, "A failure is an error, a cut-off answer or broken JSON."],
  ["All checks passed", (s) => pct(s.checksPassed), "Every expectation in every case, across all runs."],
  ["Finds missing skills", (s) => pct(s.finds), "Planted gaps that were caught."],
  ["Avoids false alarms", (s) => pct(s.noFalseAlarm), "Skills the CV clearly has that weren't called missing."],
  ["Keyword vs real skill", (s) => pct(s.keywordVsSkill), "A synonym such as K8s isn't treated as a missing skill."],
  ["Score in the expected range", (s) => pct(s.scoreBand), "Includes resisting the prompt injection and spotting a non-CV."],
  ["Avoids banned claims", (s) => pct(s.forbidden), "For example, calling recent dates future dates."],
  ["Score spread between runs", (s) => (s.averageSpread === null ? "–" : `${num(s.averageSpread)} on average, ${s.worstSpread} at worst`), "Same CV, same job, run several times."],
  ["Cases within 3 points", (s) => pct(s.steadyCases), "How often the score is steady enough to trust."],
  ["Evidence facts found in the CV", (s) => pct(s.evidenceFacts), "Names and numbers in each strength's evidence that really appear in the CV."],
  ["Evidence worded like the CV", (s) => pct(s.evidenceSupported), "Most of the evidence's words come from the CV. Lower when it adds opinion."],
  ["Evidence quoted exactly", (s) => pct(s.evidenceExact), "Word-for-word quotes, the strictest bar."],
  ["Numbers in rewrites not in the CV", (s) => (s.inventedNumbers === null ? "–" : `${s.inventedNumbers} (in ${s.runsWithInventedNumbers} runs)`), "Check these by hand: some are correct sums, such as 6 hours to 1 hour being 83% less."],
  ["Agreement with people", (s) => (s.humanAgreement === null ? `needs 5 rated cases (has ${s.humanRatedCases})` : num(s.humanAgreement, 2)), "Rank correlation with human ratings, from -1 to 1."],
  ["Average time per run", (s) => (s.averageSeconds === null ? "–" : `${num(s.averageSeconds)} s`), ""],
  ["Cost", (s) => money(s.costUsd), "At 2026 list prices. Doubles from 1 January 2027."],
];

export function renderReport(summary, meta) {
  const systems = Object.keys(summary);
  const names = { rolehint: "RoleHint", baseline: "Plain prompt" };
  const lines = [
    `# RoleHint evaluation · ${meta.date}`,
    "",
    `${meta.cases} cases, ${meta.runs} runs each, model \`${meta.model}\`${meta.mock ? ", **mock answers (not a real result)**" : ""}.`,
    "",
    `| Measure | ${systems.map((s) => names[s] ?? s).join(" | ")} | What it means |`,
    `|---|${systems.map(() => "---|").join("")}---|`,
    ...ROWS.map(([label, value, help]) => `| ${label} | ${systems.map((s) => value(summary[s])).join(" | ")} | ${help} |`),
    "",
  ];

  for (const system of systems) {
    lines.push(`## ${names[system] ?? system}, case by case`, "", "| Case | Scores | Spread | Checks passed | Missed |", "|---|---|---|---|---|");
    for (const c of summary[system].perCase) {
      lines.push(`| ${c.id} | ${c.scores.join(", ") || "–"} | ${c.spread ?? "–"} | ${c.passed} of ${c.total} | ${c.failed.join("; ") || "–"} |`);
    }
    lines.push("");
  }

  lines.push(
    "## How to read this",
    "",
    "- Known-answer cases are written with a planted fact, such as a missing skill, so the right answer is known in advance.",
    "- The plain prompt uses the same model and thinking level as RoleHint, with a one-line recruiter prompt and none of RoleHint's rules.",
    "- A handful of cases can show problems, but it can't prove quality. Add real, anonymised cases with human ratings for a fuller picture.",
    "",
  );
  return lines.join("\n");
}
