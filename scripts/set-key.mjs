// Saves the Gemini key from your clipboard into .env.local, so you don't have to paste it by hand.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const looksLikeKey = (text) => /^[A-Za-z0-9._-]{30,}$/.test(text);

export function withKey(envText, key) {
  const line = `GEMINI_API_KEY=${key}`;
  if (/^GEMINI_API_KEY=.*$/m.test(envText)) return envText.replace(/^GEMINI_API_KEY=.*$/m, () => line);
  return `${line}\n${envText}`;
}

const readClipboard = () =>
  execFileSync("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], { encoding: "utf8" }).trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const key = readClipboard();
  if (!looksLikeKey(key)) {
    console.log("Your clipboard doesn't hold an API key, so nothing was changed.");
    console.log("Click the copy icon next to your key in AI Studio, then run this again.");
    process.exit(1);
  }
  if (!existsSync(".env.local")) copyFileSync(".env.example", ".env.local");
  writeFileSync(".env.local", withKey(readFileSync(".env.local", "utf8"), key));
  console.log(`Saved. The key in .env.local now ends in ${key.slice(-4)}.`);
}
