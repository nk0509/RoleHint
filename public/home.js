/* Front page: "check my cv" opens the file picker, reads the file here, then opens the CV check with the text filled in.
   Without JavaScript the button is a plain link to /audit. */
(() => {
"use strict";
const upload = document.querySelector("#upload"), file = document.querySelector("#file"), note = document.querySelector("#uploadNote");

upload.addEventListener("click", e => { e.preventDefault(); file.click(); });

file.addEventListener("change", async () => {
  const chosen = file.files[0]; if (!chosen) return;
  note.className = "start-note";
  note.textContent = `Reading ${chosen.name}…`;
  try{
    const text = await readCvFile(chosen);
    handOffCv({ name: chosen.name, text });
    location.href = "/audit";
  }catch(err){
    note.className = "start-note err";
    note.textContent = err.message || "That file couldn't be read.";
    file.value = "";
  }
});
})();
