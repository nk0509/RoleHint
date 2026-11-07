/* Cover letter page: sends the CV and job details to the server and shows the letter as it's written. */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const statusEl = $("#status"), letterEl = $("#letter");
let tone = "formal", ctl = null;

function setStatus(msg, err){ statusEl.className = "status" + (err ? " err" : ""); statusEl.innerHTML = msg; }
const cvField = setupCvField(setStatus, "Check the text, then write your letter.");
const bot = startBotCheck(config => { if (config.lettersPerDay) $("#quota").textContent = `${config.lettersPerDay} free letters a day`; });

$("#tone").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; tone = b.dataset.v;
  $("#tone").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});

/* A CV can arrive from the front page or from a finished report. */
const handoff = takeCvHandoff();
if (handoff?.text){
  cvField.fill(handoff.text);
  if (handoff.target) $("#target").value = handoff.target;
  if (handoff.jobDescription) $("#jd").value = handoff.jobDescription;
  setStatus(`Loaded ${esc(handoff.name)}. Check the details, then write your letter.`);
}

function countBlanks(){
  const n = (letterEl.value.match(/\[[^\]\n]{1,60}\]/g) || []).length;
  $("#blanks").textContent = n ? `${n} ${n === 1 ? "blank" : "blanks"} to fill in` : "No blanks left";
}
letterEl.addEventListener("input", countBlanks);

$("#letterForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (ctl){ ctl.abort(); return; }
  const inp = { target: $("#target").value.trim(), company: $("#company").value.trim(), jobDescription: $("#jd").value.trim(), cv: $("#cv").value.trim(), tone };
  if (!inp.target){ setStatus("Enter the job title.", true); $("#target").focus(); return; }
  if (!inp.cv){ setStatus("Paste a CV or upload a file first.", true); $("#cv").focus(); return; }
  if (!$("#consent").checked){ setStatus(errMsg("consent"), true); $("#consent").focus(); return; }
  if (bot.waiting){ setStatus(errMsg("captcha"), true); return; }

  const btn = $("#runBtn");
  ctl = new AbortController();
  btn.textContent = "Stop";
  setStatus(`<span class="spinner"></span> Writing your letter…`);
  $("#exampleBanner").hidden = true;
  $("#letterActions").hidden = true;
  letterEl.readOnly = true;
  letterEl.value = "";
  let text = "", remaining = 0;
  try{
    await callApi("/api/cover-letter", { ...inp, consent: true, captcha: bot.token }, ev => {
      if (ev.type === "text"){ text += ev.text; letterEl.value = text; }
      if (ev.type === "done") remaining = ev.remaining;
    }, ctl.signal);
    $("#letterActions").hidden = false;
    countBlanks();
    setStatus(`Letter ready. ${remaining} free ${remaining === 1 ? "letter" : "letters"} left today.`);
    $("#letterCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }catch(err){
    if (err?.name === "AbortError") setStatus("Stopped.");
    else setStatus(esc(errMsg(err?.code, "letters")), true);
  }finally{
    ctl = null; btn.textContent = "Write my cover letter";
    letterEl.readOnly = false;
    bot.reset();
  }
});

$("#copyLetter").onclick = async e => {
  const b = e.currentTarget;
  try{ await navigator.clipboard.writeText(letterEl.value); b.textContent = "Copied"; }
  catch{ letterEl.select(); b.textContent = "Selected"; }
  setTimeout(() => b.textContent = "Copy", 1400);
};

$("#saveLetter").onclick = () => {
  const title = document.title;
  document.title = `Cover letter - ${$("#target").value.trim() || "Roleproof"}`;
  $("#letterPrint").textContent = letterEl.value;
  window.print();
  document.title = title;
};

/* ---------- Example state ---------- */
letterEl.value = `Dear [Hiring Manager's name],

The Senior Data Engineer role at [Company name] stood out because it centres on what I've spent five years doing: keeping high-volume data moving reliably.

In my current fintech role I own a reconciliation service that processes about 4 million UPI transactions a day on Kafka and PostgreSQL. I also lead the on-call rotation for two payment services, so I know what it takes to keep pipelines dependable when real money depends on them.

Your job description asks for streaming experience and careful data quality. I built the Kafka event bus our payment systems run on, and I designed a real-time fraud screening service that checks every transaction before it clears.

I'd welcome the chance to talk about how this experience could help your team. Thank you for reading.

Yours sincerely,
Arjun Mehta`;
letterEl.readOnly = true;
})();
