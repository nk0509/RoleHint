(() => {
"use strict";
const $ = s => document.querySelector(s);
/* ---------- Intake ---------- */
const cvEl = $("#cv"), statusEl = $("#status");
let strict = "balanced";
$("#strict").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; strict = b.dataset.v;
  $("#strict").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
function setStatus(msg, err){ statusEl.className = "status" + (err ? " err" : ""); statusEl.innerHTML = msg; }

const cvField = setupCvField(setStatus, "Check the text, then run the audit.");

/* A CV chosen on the front page arrives here. */
const handoff = takeCvHandoff();
if (handoff?.text){
  cvField.fill(handoff.text);
  setStatus(`Loaded ${esc(handoff.name)}. Enter the job you want, then run the audit.`);
  $("#target").focus();
}

/* ---------- Server ---------- */
let current = null, currentInputs = null, ctl = null, chatTurns = [];
const bot = startBotCheck(config => { if (config.auditsPerDay) $("#quota").textContent = `${config.auditsPerDay} free audits a day`; });

$("#intake").addEventListener("submit", async e => {
  e.preventDefault();
  if (ctl){ ctl.abort(); return; }
  const inp = { target: $("#target").value.trim(), level: $("#level").value, location: $("#loc").value.trim(), jobDescription: $("#jd").value.trim(), cv: cvEl.value.trim(), strictness: strict };
  if (!inp.cv){ setStatus("Paste a CV or upload a file first.", true); cvEl.focus(); return; }
  if (!inp.target){ setStatus("Enter the role you're targeting.", true); $("#target").focus(); return; }
  if (!$("#consent").checked){ setStatus(errMsg("consent"), true); $("#consent").focus(); return; }
  if (bot.waiting){ setStatus(errMsg("captcha"), true); return; }
  const btn = $("#runBtn");
  ctl = new AbortController();
  btn.textContent = "Stop";
  setStatus(`<span class="spinner"></span> Reading the CV like a recruiter would. This usually takes 30–90 seconds.`);
  try{
    let report = null, remaining = null;
    await callApi("/api/audit", { ...inp, consent: true, captcha: bot.token }, ev => {
      if (ev.type === "progress") setStatus(`<span class="spinner"></span> Writing the report… ${ev.chars.toLocaleString()} characters so far`);
      if (ev.type === "result"){ report = ev.data; remaining = ev.remaining; }
    }, ctl.signal);
    current = report; currentInputs = inp; chatTurns = [];
    render(report, { target: inp.target, jd: inp.jobDescription, loc: inp.location }, false);
    setStatus(`Audit complete. ${remaining} free ${remaining === 1 ? "audit" : "audits"} left today.`);
    $("#report").scrollIntoView({ behavior: "smooth", block: "start" });
  }catch(err){
    if (err?.name === "AbortError") setStatus("Stopped.");
    else setStatus(esc(errMsg(err?.code)), true);
  }finally{
    ctl = null; btn.textContent = "Check my CV";
    bot.reset();
  }
});

/* ---------- Rendering ---------- */
const tone = n => n >= 75 ? "good" : n >= 55 ? "warn" : "bad";
const clamp = n => Math.max(0, Math.min(100, Math.round(+n || 0)));
const list = a => Array.isArray(a) ? a : [];

function gauge(score){
  const s = clamp(score), r = 80, cx = 100, cy = 100, L = Math.PI * r;
  const col = `var(--${tone(s)})`;
  const ticks = [0,25,50,75,100].map(v => {
    const a = Math.PI * (1 - v/100), x1 = cx + (r+10)*Math.cos(a), y1 = cy - (r+10)*Math.sin(a), x2 = cx + (r+16)*Math.cos(a), y2 = cy - (r+16)*Math.sin(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--ink-3)" stroke-width="${v===75?2.5:1.2}"/>`;
  }).join("");
  return `<div class="gauge"><svg viewBox="0 0 200 118" role="img" aria-label="Fit score ${s} out of 100">
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--wash)" stroke-width="16" stroke-linecap="round"/>
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(L*s/100).toFixed(1)} ${L.toFixed(1)}"/>
    ${ticks}<text x="${(cx + (r+24)*Math.cos(Math.PI*0.25)).toFixed(0)}" y="${(cy - (r+24)*Math.sin(Math.PI*0.25)+2).toFixed(0)}" font-size="9" fill="var(--ink-3)" font-family="IBM Plex Mono, monospace">75</text>
  </svg><div class="num"><strong>${s}</strong><span>of 100 fit</span></div></div>`;
}
function boardLinks(q, loc){
  const k = encodeURIComponent(q), l = encodeURIComponent(loc || "");
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `<div class="boards">
    <a href="https://www.linkedin.com/jobs/search/?keywords=${k}${loc ? "&location=" + l : ""}" target="_blank" rel="noopener">LinkedIn</a>
    <a href="https://www.indeed.com/jobs?q=${k}${loc ? "&l=" + l : ""}" target="_blank" rel="noopener">Indeed</a>
    <a href="https://www.naukri.com/${slug}-jobs" target="_blank" rel="noopener">Naukri</a>
    <a href="https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${k}" target="_blank" rel="noopener">Glassdoor</a>
    <a href="https://www.google.com/search?q=${encodeURIComponent(q + " jobs " + (loc || ""))}&ibp=htl;jobs" target="_blank" rel="noopener">Google Jobs</a>
  </div>`;
}
function copyBtn(text){ return `<button type="button" class="copy" data-copy="${esc(text)}">Copy</button>`; }

function render(d, inp, isExample){
  const p = d.profile || {}, f = d.fit || {}, b = f.breakdown || {};
  const score = clamp(f.score);
  const verdictTone = tone(score);
  const verdictLabel = score >= 75 ? "Shortlist-ready" : score >= 55 ? "Borderline · needs tailoring" : "Weak fit for this role";
  const showPivotsFirst = score < 75;
  const html = [];
  if (isExample) html.push(`<div class="banner"><b>Example report</b><span>This is a sample audit of a fictional CV. Upload or paste any CV to run your own.</span></div>`);

  html.push(`<article class="sec"><div class="sec-h"><span class="ph">PHASE 1</span><h2>Candidate baseline</h2><span class="aside">Extracted from the CV only</span></div>
    <div class="profile-grid">
      <div class="who"><h3>${esc(p.name || "Candidate")}</h3><p><strong>${esc(p.headline || "")}</strong></p><p>${esc(p.summary || "")}</p></div>
      <dl class="facts">
        <dt>Experience</dt><dd>${esc(p.years || "Not stated")}</dd>
        <dt>Location</dt><dd>${esc(p.location || "Not stated")}</dd>
        <dt>Domains</dt><dd>${esc(list(p.domains).join(", ") || "Not stated")}</dd>
      </dl>
    </div>
    <div class="two">
      <div><div class="eyebrow" style="margin-bottom:8px">Primary stack</div><div class="chips">${list(p.stack).map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Core strengths</div><div class="chips">${list(p.strengths).map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>
    </div></article>`);

  html.push(`<article class="sec"><div class="sec-h"><span class="ph">PHASE 2</span><h2>Fit against “${esc(inp.target)}”</h2><span class="aside">${inp.jd ? "Scored against the job description" : "Scored against the role title"}</span></div>
    <div class="fit">${gauge(score)}
      <div class="verdict"><span class="pill ${verdictTone}">${verdictLabel}</span><p>${esc(f.verdict || "")}</p>
        <div class="bars">${[["Skills",b.skills],["Seniority",b.seniority],["Domain",b.domain],["Impact",b.impact]].map(([l,v]) =>
          `<div class="barrow"><span class="lab">${l}</span><span class="track"><i style="width:${clamp(v)}%;background:var(--${tone(clamp(v))})"></i></span><span class="v">${clamp(v)}</span></div>`).join("")}</div>
      </div></div>
    <div class="two">
      <ul class="list"><li><h4>Strong matches</h4></li>${list(f.strong).map(s => `<li class="item good"><div><b>${esc(s.point)}</b><small>${esc(s.evidence)}</small></div></li>`).join("")}</ul>
      <ul class="list"><li><h4>Gaps & mismatches</h4></li>${list(f.gaps).map(g => { const sv = ["high","medium","low"].includes(g.severity) ? g.severity : "medium";
        return `<li class="item ${sv}"><div><b>${esc(g.gap)}<span class="sev">${sv}</span></b><small>${esc(g.fix)}</small></div></li>`; }).join("")}</ul>
    </div>
    <div><div class="eyebrow" style="margin-bottom:8px">Missing keywords for ATS</div><div class="chips">${list(f.missingKeywords).map(k => `<span class="chip miss kw">${esc(k)}</span>`).join("")}</div></div>
  </article>`);

  html.push(`<article class="sec"><div class="sec-h"><span class="ph">PHASE 2</span><h2>Tailoring rewrites</h2><span class="aside">Fill any [bracketed] metric with your real number</span></div>
    ${f.headline ? `<div class="rewrite"><div class="eyebrow">Suggested CV headline</div><div class="after">${esc(f.headline)}</div><div class="acts">${copyBtn(f.headline)}</div></div>` : ""}
    ${list(f.rewrites).map(r => `<div class="rewrite"><div class="before">${esc(r.before)}</div>
      <div class="after">${esc(r.after).replace(/\[([^\]]{1,40})\]/g, "<mark>[$1]</mark>")}</div><div class="why">${esc(r.why)}</div><div class="acts">${copyBtn(r.after)}</div></div>`).join("")}
  </article>`);

  const pivots = `<article class="sec" id="pivotSec"><div class="sec-h"><span class="ph">PHASE 4</span><h2>Pivot roles</h2><span class="aside">${showPivotsFirst ? "Shown because fit is under 75" : "Adjacent roles you'd already be strong for"}</span></div>
    <div class="pivots">${list(d.pivots).map(v => `<div class="pivot"><div class="pivot-h"><h3>${esc(v.title)}</h3><span class="score ${tone(clamp(v.fit))}">${clamp(v.fit)}%</span></div>
      <dl><div><dt>Why it fits</dt><dd>${esc(v.why)}</dd></div><div><dt>Adjustment needed</dt><dd>${esc(v.adjustment)}</dd></div>
      ${v.headline ? `<div><dt>Headline to use</dt><dd class="hl">${esc(v.headline)}</dd></div>` : ""}
      <div><dt>Search keywords</dt><dd><div class="chips">${list(v.keywords).map(k => `<span class="chip kw">${esc(k)}</span>`).join("")}</div>${boardLinks(list(v.keywords)[0] || v.title, inp.loc)}</dd></div></dl></div>`).join("")}</div>
  </article>`;

  const market = `<article class="sec"><div class="sec-h"><span class="ph">PHASE 3</span><h2>Market roles to target</h2><span class="aside">Each links to a live job-board search</span></div>
    <div class="tablewrap"><table><thead><tr><th>Job title</th><th>Company type</th><th>Key requirements / stack</th><th>Match rationale</th><th>Fit</th></tr></thead><tbody>
    ${list(d.market).map(m => `<tr><td><div class="t">${esc(m.title)}</div>${boardLinks(m.query || m.title, inp.loc)}</td><td class="c">${esc(m.company)}</td>
      <td>${list(m.requirements).map(esc).join(" · ")}</td><td>${esc(m.rationale)}</td><td><span class="score ${tone(clamp(m.fit))}">${clamp(m.fit)}%</span></td></tr>`).join("")}
    </tbody></table></div>
    <p class="note">These are typical posting profiles for your target, not specific vacancies. The links open current listings on each job board${inp.loc ? " for " + esc(inp.loc) : ""}.</p>
  </article>`;

  if (showPivotsFirst){ html.push(pivots, market); } else { html.push(market, pivots); }

  html.push(`<article class="sec"><div class="sec-h"><span class="ph">FOLLOW-UP</span><h2>Ask the recruiter</h2><span class="aside">Questions about this audit</span></div>
    <div class="chat"><div class="msgs" id="msgs">${isExample ? `<div class="empty">Run an audit on your own CV to ask follow-up questions, like “Rewrite my summary for the pivot role” or “What should I learn first?”</div>` : `<div class="empty">Try: “Write a 3-line summary for the top pivot role” or “Which gap should I close first?”</div>`}</div>
    <form class="chatform" id="chatform"><input type="text" id="chatIn" placeholder="Ask about this CV or role…" autocomplete="off" ${isExample ? "disabled" : ""}><button class="btn primary" type="submit" ${isExample ? "disabled" : ""}>Ask</button></form></div>
  </article>`);

  html.push(`<article class="sec"><div class="sec-h"><span class="ph">NEXT STEP</span><h2>Cover letter</h2><span class="aside">Built from your CV</span></div>
    <p class="note">Turn this CV into a cover letter for “${esc(inp.target)}”. You choose the tone and can edit every word.</p>
    <div><a class="cta" id="toLetter" href="/cover-letter">Write a cover letter</a></div>
  </article>`);
  html.push(`<article class="sec"><div class="sec-h"><span class="ph">NEXT STEP</span><h2>Certifications</h2><span class="aside">Built from your CV</span></div>
    <p class="note">Not sure if a certificate would help with “${esc(inp.target)}”? See which ones are worth it, based on your CV.</p>
    <div><a class="cta" id="toCerts" href="/certifications">Check my options</a></div></article>`);

  $("#report").innerHTML = html.join("");
  if (!isExample){
    const handOver = () => handOffCv({ name: "your CV", text: currentInputs.cv, target: currentInputs.target, jobDescription: currentInputs.jobDescription });
    $("#toLetter").onclick = handOver;
    $("#toCerts").onclick = handOver;
  }
  $("#dlBtn").hidden = isExample;
  const cf = $("#chatform"); if (cf) cf.addEventListener("submit", askChat);
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try{ await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; setTimeout(() => b.textContent = "Copy", 1400); }
  catch{ const r = document.createRange(); r.selectNodeContents(b.closest(".rewrite").querySelector(".after")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; }
});

/* follow-up chat */
async function askChat(e){
  e.preventDefault();
  const inEl = $("#chatIn"), q = inEl.value.trim(); if (!q || !current) return;
  if (bot.waiting){ setStatus(errMsg("captcha"), true); return; }
  const msgs = $("#msgs"); msgs.querySelector(".empty")?.remove();
  const u = document.createElement("div"); u.className = "msg u"; u.textContent = q; msgs.append(u);
  const a = document.createElement("div"); a.className = "msg a"; a.textContent = "Thinking…"; msgs.append(a);
  msgs.scrollTop = msgs.scrollHeight; inEl.value = "";
  chatTurns.push({ role: "user", content: q });
  const audit = JSON.stringify({ score: current.fit.score, verdict: current.fit.verdict, gaps: current.fit.gaps, pivots: list(current.pivots).map(p => p.title) }).slice(0, 8000);
  let text = "";
  try{
    await callApi("/api/chat", { target: currentInputs.target, cv: currentInputs.cv, audit, turns: chatTurns.slice(-11), captcha: bot.token }, ev => {
      if (ev.type === "text"){ text += ev.text; a.textContent = text; msgs.scrollTop = msgs.scrollHeight; }
    });
    chatTurns.push({ role: "assistant", content: text });
  }catch(err){
    a.textContent = errMsg(err?.code, "questions");
    chatTurns.pop();
  }finally{
    bot.reset();
  }
}

/* markdown export */
function toMarkdown(d, inp){
  const p = d.profile, f = d.fit, row = a => "| " + a.map(x => String(x ?? "").replace(/\|/g, "/").replace(/\n/g, " ")).join(" | ") + " |";
  return [
    `# CV Audit: ${p.name || "Candidate"} → ${inp.target}`, "",
    `## Phase 1 · Baseline`, `- **Headline:** ${p.headline}`, `- **Experience:** ${p.years}`, `- **Stack:** ${list(p.stack).join(", ")}`, `- **Domains:** ${list(p.domains).join(", ")}`, `- **Strengths:** ${list(p.strengths).join(", ")}`, "", p.summary, "",
    `## Phase 2 · Fit: ${clamp(f.score)}%`, f.verdict, "",
    `Skills ${clamp(f.breakdown?.skills)} · Seniority ${clamp(f.breakdown?.seniority)} · Domain ${clamp(f.breakdown?.domain)} · Impact ${clamp(f.breakdown?.impact)}`, "",
    `### Strong matches`, ...list(f.strong).map(s => `- **${s.point}**: ${s.evidence}`), "",
    `### Gaps`, ...list(f.gaps).map(g => `- **${g.gap}** (${g.severity}): ${g.fix}`), "",
    `### Missing keywords`, list(f.missingKeywords).join(", "), "",
    `### Tailoring rewrites`, f.headline ? `**Headline:** ${f.headline}\n` : "", ...list(f.rewrites).map(r => `- ~~${r.before}~~\n  → ${r.after}\n  _${r.why}_`), "",
    `## Phase 3 · Market roles`, row(["Job Title","Company","Key Requirements / Stack","Match Rationale","Fit"]), row(["---","---","---","---","---"]),
    ...list(d.market).map(m => row([m.title, m.company, list(m.requirements).join(", "), m.rationale, clamp(m.fit) + "%"])), "",
    `## Phase 4 · Pivot roles`, ...list(d.pivots).flatMap(v => [`### ${v.title} (${clamp(v.fit)}%)`, `- **Why it fits:** ${v.why}`, `- **Adjustment needed:** ${v.adjustment}`, `- **Headline:** ${v.headline}`, `- **Search keywords:** ${list(v.keywords).join(", ")}`, ""]),
  ].join("\n");
}
$("#dlBtn").onclick = () => {
  if (!current) return;
  const url = URL.createObjectURL(new Blob([toMarkdown(current, currentInputs)], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(currentInputs.target || "role").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-cv-audit.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/* ---------- Example state ---------- */
const EXAMPLE_INPUT = { target: "Senior Machine Learning Engineer", loc: "Bengaluru", jd: "" };
const EXAMPLE = {
  profile: { name: "Arjun Mehta (fictional)", headline: "Backend Engineer · Payments & event-driven systems", years: "5 years 8 months", location: "Pune, India",
    stack: ["Java 17","Spring Boot","Kafka","PostgreSQL","AWS (ECS, RDS, S3)","Redis","Python (scripting)","Docker"],
    domains: ["Fintech payments","UPI reconciliation","Fraud rules"], strengths: ["High-throughput service design","Production ownership & on-call","Data pipeline reliability","Cross-team delivery"],
    summary: "Builds and runs payment back-ends at scale: reconciliation services processing ~4M UPI transactions a day, a Kafka event bus, and a rules-based fraud screening service. Python use is limited to scripts and one scikit-learn proof of concept." },
  fit: { score: 58, verdict: "Strong engineer, wrong shelf for this title. The CV proves production backend depth but shows one ML proof of concept and no model training, evaluation or deployment ownership. A senior ML panel would read this as a career switch, not a senior hire.",
    breakdown: { skills: 48, seniority: 78, domain: 62, impact: 55 },
    strong: [{ point: "Production-grade data pipelines", evidence: "Kafka event bus and reconciliation services at ~4M tx/day map to ML feature and inference pipelines." },
      { point: "Fraud domain exposure", evidence: "Built the rules engine that an ML fraud model would replace or augment." },
      { point: "Senior-level ownership", evidence: "Led on-call rotation and owned SLOs for two services." },
      { point: "Cloud deployment", evidence: "AWS ECS/RDS experience covers the serving side of MLOps." }],
    gaps: [{ gap: "No model training or evaluation work", severity: "high", fix: "Ship one end-to-end model (fraud scoring is ideal) and describe metrics like AUC and precision at a fixed recall." },
      { gap: "Missing core ML stack", severity: "high", fix: "PyTorch or XGBoost, MLflow, feature stores are absent. Add only what you have actually used." },
      { gap: "Python is secondary", severity: "medium", fix: "Move Python work into job bullets, not only the skills list." },
      { gap: "Impact bullets lack numbers", severity: "medium", fix: "Add latency, cost and incident figures to each role." },
      { gap: "No experimentation or A/B evidence", severity: "low", fix: "Mention any rollout or shadow-mode comparisons you ran for fraud rules." }],
    missingKeywords: ["PyTorch","XGBoost","MLflow","Feature store","Model monitoring","A/B testing","SageMaker","Airflow","Model drift","Embeddings"],
    headline: "Backend & Data Platform Engineer · Real-time payments, fraud signals, ML-ready pipelines",
    rewrites: [{ before: "Worked on reconciliation service for UPI payments.", after: "Owned the UPI reconciliation service processing ~4M transactions/day on Kafka and PostgreSQL, cutting mismatch resolution time by [X%].", why: "Shows scale and ownership; the metric slot invites a real number." },
      { before: "Built fraud rules engine.", after: "Designed a real-time fraud screening service (Java, Redis) evaluating [N] rules per transaction at p99 < [X] ms; exported labelled outcomes later used to prototype a scikit-learn classifier.", why: "Connects the rules work to ML data and the PoC." },
      { before: "Did a POC on ML for fraud.", after: "Prototyped a gradient-boosted fraud classifier in Python/scikit-learn on [N]M labelled transactions, reaching [AUC] versus the rules baseline.", why: "Turns a vague PoC into evidence of ML evaluation." },
      { before: "Handled on-call and production issues.", after: "Led a 6-person on-call rotation for two Tier-1 payment services, holding [99.9X%] availability across [N] quarters.", why: "Seniority signal recruiters scan for." }] },
  market: [
    { title: "Senior ML Engineer, Fraud & Risk", company: "Series C fintech / payments", requirements: ["Python, PyTorch or XGBoost","Real-time inference","Feature stores","Fraud modelling"], rationale: "Domain is a direct match; modelling depth is the gap.", fit: 61, query: "Senior Machine Learning Engineer fraud" },
    { title: "ML Platform Engineer", company: "Large e-commerce marketplace", requirements: ["Kubernetes","Kafka","MLflow or Kubeflow","Model serving"], rationale: "Platform side rewards your pipeline and infra work.", fit: 72, query: "ML Platform Engineer" },
    { title: "Senior ML Engineer, Recommendations", company: "Consumer internet / streaming", requirements: ["Deep learning","Ranking models","Spark","A/B testing"], rationale: "Little overlap beyond data engineering.", fit: 41, query: "Senior Machine Learning Engineer recommendation" },
    { title: "MLOps Engineer", company: "Global bank tech centre", requirements: ["AWS SageMaker","CI/CD for models","Monitoring & drift","Python"], rationale: "Deployment and reliability strengths transfer well.", fit: 68, query: "MLOps Engineer" },
    { title: "Applied ML Engineer, Risk", company: "Insurance / lending startup", requirements: ["Tabular ML","Credit or fraud data","SQL","Model explainability"], rationale: "Tabular fraud data is familiar ground.", fit: 59, query: "Applied Machine Learning Engineer risk" }],
  pivots: [
    { title: "Senior Data Engineer (Streaming)", fit: 88, why: "Kafka, high-volume reconciliation pipelines and PostgreSQL are the job.", adjustment: "Lead with pipeline throughput and data-quality numbers; push the Java API work lower.", headline: "Senior Data Engineer · Real-time Kafka pipelines at 4M+ events/day", keywords: ["Senior Data Engineer Kafka","Streaming Data Engineer","Real-time data platform"] },
    { title: "ML Platform / MLOps Engineer", fit: 74, why: "Serving, reliability and AWS deployment cover most of the role; it's the shortest bridge to ML.", adjustment: "Add the scikit-learn PoC as a project and learn MLflow on it before applying.", headline: "Platform Engineer · Production data systems moving into ML infrastructure", keywords: ["MLOps Engineer","ML Platform Engineer","ML infrastructure"] },
    { title: "Senior Backend Engineer, Payments", fit: 92, why: "This is the CV as written: UPI, reconciliation, on-call ownership.", adjustment: "Add latency and availability metrics; keep the title as is.", headline: "Senior Backend Engineer · UPI payments & reconciliation at scale", keywords: ["Senior Backend Engineer payments","Java Spring Boot fintech","UPI backend engineer"] },
    { title: "Risk & Fraud Platform Engineer", fit: 85, why: "Built the fraud rules engine and knows the transaction data model.", adjustment: "Make the fraud service the first bullet of the current role.", headline: "Fraud Platform Engineer · Real-time transaction screening", keywords: ["Fraud platform engineer","Risk engineering","Transaction monitoring engineer"] },
    { title: "Site Reliability Engineer (Fintech)", fit: 78, why: "On-call leadership, SLO ownership and AWS operations.", adjustment: "Rewrite incidents as SRE outcomes: MTTR, error budgets, automation.", headline: "SRE · Payment systems reliability and incident leadership", keywords: ["Site Reliability Engineer fintech","SRE payments","Production engineer"] }],
};
render(EXAMPLE, EXAMPLE_INPUT, true);
})();
