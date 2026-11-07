// Copies the browser file-reading libraries into public/vendor so the site serves them itself.
import { copyFileSync, mkdirSync } from "node:fs";

const files = [
  ["node_modules/pdfjs-dist/build/pdf.min.mjs", "public/vendor/pdf.min.mjs"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs"],
  ["node_modules/mammoth/mammoth.browser.min.js", "public/vendor/mammoth.browser.min.js"],
];
mkdirSync("public/vendor", { recursive: true });
for (const [from, to] of files) copyFileSync(from, to);
