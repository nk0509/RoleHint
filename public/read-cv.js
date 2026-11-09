/* Reads CV files inside the browser and moves the text between pages. Used by the front page, the CV check and the cover letter page. */
const CV_HANDOFF_KEY = "rolehint-cv";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
}

async function extractText(f){
  const name = f.name.toLowerCase(); let text = "";
  if (name.endsWith(".pdf") || f.type === "application/pdf"){
    const pdfjsLib = await import("/vendor/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer(), isEvalSupported: false }).promise;
    for (let i = 1; i <= pdf.numPages; i++){
      const c = await (await pdf.getPage(i)).getTextContent();
      let line = "", lastY = null;
      for (const it of c.items){
        const y = it.transform ? it.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2){ text += line.trimEnd() + "\n"; line = ""; }
        line += it.str + (it.hasEOL ? "\n" : " "); lastY = y;
      }
      text += line + "\n\n";
    }
  } else if (name.endsWith(".docx")){
    if (!window.mammoth) await loadScript("/vendor/mammoth.browser.min.js");
    text = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
  } else {
    text = await f.text();
  }
  return text;
}

async function readCvFile(f){
  if (f.name.toLowerCase().endsWith(".doc")) throw new Error("Old .doc files can't be read here. Save it as .docx or PDF and upload again.");
  let text;
  try{ text = await extractText(f); }
  catch{ throw new Error("That file couldn't be read. Try another copy, or paste the text instead."); }
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 80) throw new Error("Very little text came out of that file. If it's a scanned PDF, paste the text instead.");
  return text;
}

// Carries a CV to the next page in this tab. That page removes it straight away.
function handOffCv(details){
  try{ sessionStorage.setItem(CV_HANDOFF_KEY, JSON.stringify(details)); }catch{}
}

function takeCvHandoff(){
  try{
    const details = JSON.parse(sessionStorage.getItem(CV_HANDOFF_KEY));
    sessionStorage.removeItem(CV_HANDOFF_KEY);
    return details;
  }catch{ return null; }
}

// Wires up the CV box on a page: word count, Clear, drag and drop, and file reading.
function setupCvField(setStatus, loadedHint){
  const cv = document.querySelector("#cv"), file = document.querySelector("#file"), drop = document.querySelector("#drop");
  const update = () => {
    const w = (cv.value.trim().match(/\S+/g) || []).length;
    document.querySelector("#cvMeta").textContent = `${w.toLocaleString()} words${w && w < 120 ? " · looks short for a CV" : ""}`;
  };
  const load = async f => {
    setStatus(`<span class="spinner"></span> Reading ${esc(f.name)}…`);
    try{
      cv.value = await readCvFile(f); update();
      setStatus(`Loaded ${esc(f.name)}. ${loadedHint}`);
    }catch(err){ setStatus(esc(err.message), true); }
    file.value = "";
  };
  cv.addEventListener("input", update);
  document.querySelector("#clearCv").onclick = () => { cv.value = ""; update(); cv.focus(); };
  drop.onclick = () => file.click();
  drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
  file.onchange = () => file.files[0] && load(file.files[0]);
  ["dragenter","dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave","drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) load(f); });
  update();
  return { fill(text){ cv.value = text; update(); } };
}
