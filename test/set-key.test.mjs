import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeKey, withKey } from "../scripts/set-key.mjs";

test("the saved key replaces the old one and leaves other settings alone", () => {
  const before = "# note\nGEMINI_API_KEY=old\nAUDITS_PER_DAY_TOTAL=50\n";
  assert.equal(withKey(before, "new$&key"), "# note\nGEMINI_API_KEY=new$&key\nAUDITS_PER_DAY_TOTAL=50\n");
});

test("a key is added when the file has no key line", () => {
  assert.equal(withKey("AUDITS_PER_DAY_TOTAL=50\n", "new"), "GEMINI_API_KEY=new\nAUDITS_PER_DAY_TOTAL=50\n");
});

test("only key-shaped clipboard text is accepted", () => {
  assert.ok(looksLikeKey(`AQ.${"a".repeat(50)}`));
  assert.ok(!looksLikeKey("some copied sentence with spaces in it that is long enough"));
  assert.ok(!looksLikeKey("short"));
  assert.ok(!looksLikeKey(""));
});
