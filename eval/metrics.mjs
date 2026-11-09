/* The evaluation's scoring rules. Pure functions with no AI calls and no file access, so test/eval.test.mjs can check them for free. */

// Gemini 3.8 Flash list prices in US dollars per million tokens, valid to 31 December 2026. They double on 1 January 2027.
export const PRICES = { input: 0.75, output: 3.75 };
export const RUPEES_PER_DOLLAR = 88;

export const normalise = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True if any spelling appears as a whole word or phrase. A trailing * matches any ending, so "quantif*" finds "quantified".
export function mentions(text, spellings) {
  const haystack = normalise(text);
  return spellings.some((spelling) => {
    const open = spelling.endsWith("*");
    const word = escapeRegex(normalise(open ? spelling.slice(0, -1) : spelling));
    return new RegExp(`(?<![a-z0-9])${word}${open ? "" : "(?![a-z0-9])"}`).test(haystack);
  });
}

/* ---------- Statistics ---------- */

export const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
export const spread = (values) => (values.length ? Math.max(...values) - Math.min(...values) : null);

function ranks(values) {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
  const result = Array(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) result[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return result;
}

function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let top = 0, vx = 0, vy = 0;
  xs.forEach((x, i) => {
    top += (x - mx) * (ys[i] - my);
    vx += (x - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  });
  return vx && vy ? top / Math.sqrt(vx * vy) : null;
}

// Rank correlation from -1 to 1: do higher human ratings go with higher scores? Needs at least 5 pairs to mean anything.
export const spearman = (xs, ys) => (xs.length >= 5 ? pearson(ranks(xs), ranks(ys)) : null);

/* ---------- Grounding and invented numbers ---------- */

const STOP_WORDS = new Set(["with", "from", "that", "this", "have", "been", "were", "into", "over", "their", "which", "using", "used", "based", "about", "more", "than", "also", "they", "them", "then", "when", "where", "what", "your", "each", "while", "across", "through", "candidate", "experience"]);
const words = (text) => normalise(text).match(/[a-z0-9][a-z0-9+#.%-]*/g) ?? [];

// Is a claim backed by the source? Exact means it's a direct quote. Supported means most of its meaningful words appear in the source.
export function supportedBy(claim, source) {
  const text = normalise(source);
  if (normalise(claim) && text.includes(normalise(claim))) return { exact: true, supported: true };
  const meaningful = words(claim).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  if (!meaningful.length) return { exact: false, supported: false };
  const found = meaningful.filter((word) => text.includes(word)).length;
  return { exact: false, supported: found / meaningful.length >= 0.6 };
}

// Numbers outside [brackets], written without thousands commas. Numbers glued to a letter, such as p99 or EC2, are names rather than results.
const numbersIn = (text) => new Set((String(text ?? "").replace(/\[[^\]]*\]/g, " ").match(/(?<![a-z0-9])\d+(?:[.,]\d+)*/gi) ?? []).map((n) => n.replace(/,/g, "")));

// The checkable facts in a claim: numbers, and names written with capitals or symbols, such as PyTorch, M.Sc or C#.
const factsIn = (text) =>
  (String(text ?? "").match(/[A-Za-z0-9][A-Za-z0-9+#.&/-]*/g) ?? [])
    .filter((token, i) => /\d/.test(token) || (i > 0 && /^[A-Z]/.test(token)) || /[A-Z].*[A-Z]|[+#]/.test(token))
    .map((token) => normalise(token.replace(/[.,]+$/, "")))
    .filter((token) => token.length > 1);

// Evidence often mixes a fact with an opinion, such as "an M.Sc from Madras, giving strong numeracy". Only the facts can be checked against the CV.
export function factsSupported(claim, source) {
  const text = normalise(source);
  const facts = factsIn(claim);
  if (!facts.length) return null;
  return facts.filter((fact) => text.includes(fact)).length / facts.length >= 0.8;
}

// Numbers in a rewrite that appear in none of the allowed sources. RoleHint should never invent a result.
export function inventedNumbers(rewrite, allowedSources) {
  const allowed = new Set(allowedSources.flatMap((source) => [...numbersIn(source)]));
  return [...numbersIn(rewrite)].filter((number) => !allowed.has(number));
}

export function grounding(report, cv) {
  const evidence = (report.fit?.strong ?? []).map((item) => item.evidence).filter(Boolean);
  const checked = evidence.map((claim) => supportedBy(claim, cv));
  const facts = evidence.map((claim) => factsSupported(claim, cv)).filter((result) => result !== null);
  const rewrites = report.fit?.rewrites ?? [];
  return {
    evidence: evidence.length,
    exact: checked.filter((c) => c.exact).length,
    supported: checked.filter((c) => c.supported).length,
    withFacts: facts.length,
    factsFound: facts.filter(Boolean).length,
    rewrites: rewrites.length,
    invented: rewrites.flatMap((r) => inventedNumbers(r.after, [cv, r.before])),
  };
}

/* ---------- Checking a report against a case's expectations ---------- */

// Turns the plain-prompt baseline's answer into the same shape as a RoleHint report, so both are checked the same way.
// Every skill it lists is a claim that the skill is missing, so the list fills both the gaps and the missing keywords.
export const baselineAsReport = (answer) => {
  const skills = answer.missingSkills ?? [];
  return { fit: { score: answer.score, verdict: "", gaps: skills.map((gap) => ({ gap, fix: "" })), missingKeywords: skills, strong: [], rewrites: [] } };
};

// Does a gap title say the skill is absent, as in "No SQL" or "Absence of Kubernetes experience"?
// "Lack of detail on data modelling in Power BI" asks for more depth, so it doesn't count.
const ABSENT = "(?:no|missing|absence of|absent|lack of|lacks|lacking|without|not)";
function saysAbsent(text, spellings) {
  const haystack = normalise(text);
  return spellings.some((spelling) => {
    const open = spelling.endsWith("*");
    const word = escapeRegex(normalise(open ? spelling.slice(0, -1) : spelling));
    return new RegExp(`(?<![a-z0-9])${ABSENT}\\s+(?:[a-z0-9()&/-]+\\s+)?${word}${open ? "" : "(?![a-z0-9])"}`).test(haystack);
  });
}

export function checkReport(report, expect = {}) {
  const fit = report.fit ?? {};
  const gaps = fit.gaps ?? [];
  const gapTitles = gaps.map((g) => g.gap).join(" | ");
  const gapText = gaps.map((g) => `${g.gap} ${g.fix}`).join(" | ");
  const keywords = (fit.missingKeywords ?? []).join(" | ");
  const checks = [];
  const add = (kind, name, pass) => checks.push({ kind, name, pass: Boolean(pass) });

  for (const s of expect.missing ?? []) add("finds", `finds missing ${s[0].replace("*", "")}`, mentions(`${gapText} | ${keywords}`, s));
  for (const s of expect.notMissing ?? []) add("noFalseAlarm", `doesn't call ${s[0]} missing`, !mentions(keywords, s) && !gaps.some((g) => saysAbsent(g.gap, s)));
  for (const s of expect.notAGap ?? []) add("keywordVsSkill", `doesn't list ${s[0]} as a skill gap`, !mentions(gapTitles, s));
  if (expect.score?.min != null) add("scoreBand", `score at least ${expect.score.min}`, fit.score >= expect.score.min);
  if (expect.score?.max != null) add("scoreBand", `score at most ${expect.score.max}`, fit.score <= expect.score.max);
  // Sub-scores are checked only when the answer has them. The plain prompt doesn't, so this doesn't count against it.
  if (fit.breakdown) for (const [part, max] of Object.entries(expect.breakdownMax ?? {})) add("scoreBand", `${part} at most ${max}`, (fit.breakdown[part] ?? Infinity) <= max);
  if (expect.minGaps) add("scoreBand", `lists at least ${expect.minGaps} gaps`, gaps.length >= expect.minGaps);
  for (const phrase of expect.forbidden ?? []) add("forbidden", `never says "${phrase}"`, !normalise(`${gapText} ${fit.verdict ?? ""}`).includes(normalise(phrase)));
  return checks;
}

/* ---------- Cost ---------- */

export function costUsd(usage = {}) {
  const input = usage.total_input_tokens ?? 0;
  const output = (usage.total_output_tokens ?? 0) + (usage.total_thought_tokens ?? 0);
  return (input * PRICES.input + output * PRICES.output) / 1_000_000;
}

/* ---------- Summary across all runs ---------- */

const share = (items, test) => (items.length ? items.filter(test).length / items.length : null);

export function summarise(runs, cases) {
  const systems = {};
  for (const system of [...new Set(runs.map((r) => r.system))]) {
    const mine = runs.filter((r) => r.system === system);
    const done = mine.filter((r) => r.ok);
    const checks = done.flatMap((r) => r.checks);
    const byKind = (kind) => share(checks.filter((c) => c.kind === kind), (c) => c.pass);

    const perCase = cases.map((kase) => {
      const caseRuns = done.filter((r) => r.caseId === kase.id);
      const scores = caseRuns.map((r) => r.score).filter((s) => Number.isFinite(s));
      const caseChecks = caseRuns.flatMap((r) => r.checks);
      return {
        id: kase.id,
        scores,
        spread: spread(scores),
        passed: caseChecks.filter((c) => c.pass).length,
        total: caseChecks.length,
        failed: [...new Set(caseChecks.filter((c) => !c.pass).map((c) => c.name))],
        human: kase.human?.length ? mean(kase.human) : null,
      };
    });

    const spreads = perCase.map((c) => c.spread).filter((s) => s !== null);
    const rated = perCase.filter((c) => c.human !== null && c.scores.length);
    const ground = done.map((r) => r.grounding).filter(Boolean);
    const evidence = ground.reduce((sum, g) => sum + g.evidence, 0);

    systems[system] = {
      runs: mine.length,
      failures: mine.length - done.length,
      checksPassed: share(checks, (c) => c.pass),
      finds: byKind("finds"),
      noFalseAlarm: byKind("noFalseAlarm"),
      keywordVsSkill: byKind("keywordVsSkill"),
      scoreBand: byKind("scoreBand"),
      forbidden: byKind("forbidden"),
      averageSpread: mean(spreads),
      worstSpread: spreads.length ? Math.max(...spreads) : null,
      steadyCases: share(spreads, (s) => s <= 3),
      evidenceFacts: ground.reduce((sum, g) => sum + g.withFacts, 0) ? ground.reduce((sum, g) => sum + g.factsFound, 0) / ground.reduce((sum, g) => sum + g.withFacts, 0) : null,
      evidenceSupported: ground.length && evidence ? ground.reduce((sum, g) => sum + g.supported, 0) / evidence : null,
      evidenceExact: ground.length && evidence ? ground.reduce((sum, g) => sum + g.exact, 0) / evidence : null,
      inventedNumbers: ground.length ? ground.reduce((sum, g) => sum + g.invented.length, 0) : null,
      runsWithInventedNumbers: ground.length ? ground.filter((g) => g.invented.length).length : null,
      humanAgreement: spearman(rated.map((c) => mean(c.scores)), rated.map((c) => c.human)),
      humanRatedCases: rated.length,
      averageSeconds: mean(done.map((r) => r.ms / 1000)),
      costUsd: mine.reduce((sum, r) => sum + costUsd(r.usage), 0),
      perCase,
    };
  }
  return systems;
}
