/* Certifications page: shows a sample plan, sends the CV and job to the server, then shows which certificates would help.
   Certificate details come from lib/certifications.js through the server, so nothing about a certificate is written here. */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const statusEl = $("#status"), planEl = $("#plan");
let ctl = null, hasOwnPlan = false;

function setStatus(msg, err){ statusEl.className = "status" + (err ? " err" : ""); statusEl.innerHTML = msg; }
const cvField = setupCvField(setStatus, "Check the details, then run the check.");
const bot = startBotCheck(config => { if (config.certChecksPerDay) $("#quota").textContent = `${config.certChecksPerDay} free checks a day`; });

/* A CV can arrive from a finished report. */
const handoff = takeCvHandoff();
if (handoff?.text){
  cvField.fill(handoff.text);
  if (handoff.target) $("#target").value = handoff.target;
  if (handoff.jobDescription) $("#jd").value = handoff.jobDescription;
  setStatus(`Loaded ${esc(handoff.name)}. Check the details, then run the check.`);
}

const monthName = checked => new Date(`${checked}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function certCard(cert){
  const facts = [["Cost", cert.cost], ["Validity", cert.valid], ["Level", cert.level]];
  return `<div class="cert-card">
    <div>
      <h4>${esc(cert.name)}</h4>
      <p class="note">${esc([cert.provider, cert.code].filter(Boolean).join(" · "))}</p>
    </div>
    <dl class="cert-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${cert.needs ? `<p class="cert-note">You'll need: ${esc(cert.needs)}.</p>` : ""}
    ${cert.note ? `<p class="cert-note">${esc(cert.note)}</p>` : ""}
    <a class="cert-link" href="${esc(cert.url)}" target="_blank" rel="noopener noreferrer">Official page</a>
  </div>`;
}

function adProof(item, hasAd){
  if (!hasAd) return "";
  return item.quote
    ? `<p class="ad-proof"><b>In this job ad:</b> “${esc(item.quote)}”</p>`
    : `<p class="ad-proof">This job ad doesn't ask for it by name.</p>`;
}

function adviceCard(item, hasAd){
  return `<article class="sec advice">
    <h3>${esc(item.skill)}</h3>
    <p>${esc(item.why)}</p>
    ${adProof(item, hasAd)}
    ${certCard(item.cert)}
    <div class="cv-line"><div><b>Add this to your CV once you've earned it</b><p>${esc(item.cvLine)}</p></div><button type="button" class="copy" data-copy="${esc(item.cvLine)}">Copy</button></div>
  </article>`;
}

function retiredFlag(item){
  const link = item.replacement ? ` The closest current option is <a href="${esc(item.replacement.url)}" target="_blank" rel="noopener noreferrer">${esc(item.replacement.name)}</a>.` : "";
  const name = `<b>${esc(item.name)} (${esc(item.code)})</b>`;
  const lead = item.inAd
    ? `This job ad mentions ${name}, which closed to new candidates on ${esc(item.closed)}. The ad may be out of date, so it's worth asking the employer.`
    : `Your CV lists ${name}, which closed to new candidates on ${esc(item.closed)}. If you earned it, it stays valid until its own expiry date.`;
  return `<div class="retired-flag"><b class="retired-tag">No longer offered</b><p>${lead}${link}</p></div>`;
}

function render(plan){
  planEl.innerHTML = `<article class="sec">
      <div class="sec-h"><h2>Your plan</h2><span class="aside">${plan.hasAd ? "Based on your CV and this job ad" : "Based on your CV and the job title"}</span></div>
      <p class="plan-summary">${esc(plan.summary)}</p>
    </article>
    ${plan.retired.map(retiredFlag).join("")}
    ${plan.advice.map(item => adviceCard(item, plan.hasAd)).join("")}`;
}

planEl.addEventListener("click", async e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try{ await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; }
  catch{ b.textContent = "Press and hold to copy"; }
  setTimeout(() => b.textContent = "Copy", 1400);
});

/* The sample plan, and how fresh the list is. */
fetch("/api/certifications").then(r => r.json()).then(sample => {
  const trust = $("#trust");
  trust.textContent = `No paid rankings and no affiliate links. We check all ${sample.count} certificates on their official pages by hand, last in ${monthName(sample.checked)}.`;
  trust.hidden = false;
  if (!hasOwnPlan) render(sample);
}).catch(() => { if (!hasOwnPlan) $("#exampleBanner").hidden = true; });

$("#certForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (ctl){ ctl.abort(); return; }
  const inp = { target: $("#target").value.trim(), jobDescription: $("#jd").value.trim(), cv: $("#cv").value.trim() };
  if (!inp.target){ setStatus("Enter the job title.", true); $("#target").focus(); return; }
  if (!inp.cv){ setStatus("Paste a CV or upload a file first.", true); $("#cv").focus(); return; }
  if (!$("#consent").checked){ setStatus(errMsg("consent"), true); $("#consent").focus(); return; }
  if (bot.waiting){ setStatus(errMsg("captcha"), true); return; }

  const btn = $("#runBtn");
  ctl = new AbortController();
  btn.textContent = "Stop";
  setStatus(`<span class="spinner"></span> Comparing your CV with the job. This usually takes under a minute.`);
  try{
    let plan = null, remaining = 0;
    await callApi("/api/certifications", { ...inp, consent: true, captcha: bot.token }, ev => {
      if (ev.type === "result"){ plan = ev.data; remaining = ev.remaining; }
    }, ctl.signal);
    hasOwnPlan = true;
    $("#exampleBanner").hidden = true;
    render(plan);
    setStatus(`Plan ready. ${remaining} free ${remaining === 1 ? "check" : "checks"} left today.`);
    planEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }catch(err){
    if (err?.name === "AbortError") setStatus("Stopped.");
    else setStatus(esc(errMsg(err?.code, "checks")), true);
  }finally{
    ctl = null; btn.textContent = "Check my options";
    bot.reset();
  }
});
})();
