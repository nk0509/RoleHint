/* Server calls shared by the CV check, the cover letter page and the certifications page. */
const ERR = {
  forbidden: "This request was blocked. Reload the page and try again.",
  too_long: "The CV or job description is too long. Trim it and try again. The limits are 40,000 and 12,000 characters.",
  too_short: "That CV looks too short to review. Paste the full text.",
  consent: "Tick the box to agree before you continue.",
  captcha: "The bot check didn't complete. Wait a moment and try again.",
  busy: "The service is busy right now. Wait a minute and try again.",
  unavailable: "The service is temporarily unavailable. Please try again later.",
  refused: "This text couldn't be reviewed. Check that it's a CV and try again.",
  truncated: "The reply came back incomplete. Please try again.",
};

function errMsg(code, noun = "audits"){
  if (code === "limit_visitor") return `You've used today's free ${noun}. Come back tomorrow.`;
  if (code === "limit_site") return `Today's free ${noun} have all been used. Come back tomorrow.`;
  return ERR[code] || "The connection dropped before it finished. Please try again.";
}

// Calls an API route and hands each streamed event to onEvent. Rejects with {code}.
async function callApi(path, body, onEvent, signal){
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body){
    const err = await res.json().catch(() => ({}));
    throw { code: err.code || "upstream" };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "", finished = false;
  const handle = line => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw { code: event.code };
    if (event.type === "result" || event.type === "done") finished = true;
    onEvent(event);
  };
  for (;;){
    const { value, done } = await reader.read();
    if (done) break;
    const lines = (pending + value).split("\n");
    pending = lines.pop();
    lines.forEach(handle);
  }
  handle(pending);
  if (!finished) throw { code: "upstream" };
}

// Reads the site settings and, when it's turned on, shows the bot check in #captcha.
function startBotCheck(onConfig){
  let token = null, id = null;
  fetch("/api/config").then(r => r.json()).then(config => {
    onConfig(config);
    if (!config.turnstileSiteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload = () => {
      id = turnstile.render("#captcha", { sitekey: config.turnstileSiteKey, callback: t => { token = t; }, "expired-callback": () => { token = null; } });
    };
    document.head.append(script);
  }).catch(() => {});
  return {
    get waiting(){ return id !== null && !token; },
    get token(){ return token; },
    reset(){ if (id !== null){ token = null; turnstile.reset(id); } },
  };
}
