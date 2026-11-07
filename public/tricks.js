/* Front page tricks: the changing word in the headline, the button that runs away, the x-ray CV,
   the feedback switch and the tab title. Without JavaScript the page still reads fine,
   and "apply anyway" is a plain link to the CV check. */
(() => {
"use strict";
const $ = selector => document.querySelector(selector);
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Headline word
const word = $("#word"), words = ["ghosted.", "left on read.", "overlooked.", "passed over."];
if (!calm){
  let index = 0;
  setInterval(() => {
    word.classList.add("swap");
    setTimeout(() => {
      index = (index + 1) % words.length;
      word.textContent = words[index];
      word.classList.remove("swap");
    }, 260);
  }, 2400);
}

// "apply anyway" playfully dodges a few times, then sends you to the CV check
const decoy = $("#decoy"), lines = ["hold on", "just a sec", "almost", "one quick check?", "nearly there", "let's check it first"];
let dodges = 0, offsetX = 0, offsetY = 0;

function dodge(pointerX, pointerY){
  decoy.textContent = lines[dodges++];
  if (dodges === lines.length){
    decoy.style.translate = "";
    decoy.classList.add("gave-up");
    return;
  }
  const area = decoy.closest(".blast").getBoundingClientRect(), box = decoy.getBoundingClientRect();
  const left = box.left - offsetX, top = box.top - offsetY;
  let x = 0, y = 0;
  for (let tries = 0; tries < 12; tries++){
    x = area.left + 12 + Math.random() * Math.max(0, area.width - box.width - 24);
    y = area.top + 12 + Math.random() * Math.max(0, area.height - box.height - 24);
    if (Math.hypot(x + box.width / 2 - pointerX, y + box.height / 2 - pointerY) > 190) break;
  }
  offsetX = x - left;
  offsetY = y - top;
  decoy.style.translate = `${offsetX}px ${offsetY}px`;
}

decoy.addEventListener("pointerenter", e => {
  if (e.pointerType === "mouse" && dodges < lines.length) dodge(e.clientX, e.clientY);
});
decoy.addEventListener("click", e => {
  if (dodges >= lines.length) return;
  e.preventDefault();
  dodge(e.clientX, e.clientY);
});

// X-ray CV: a second copy of the CV sits on top and only shows inside the moving circle
const xray = $("#xray");
if (!calm){
  const cover = xray.querySelector(".cv").cloneNode(true);
  cover.classList.add("cv-top");
  cover.setAttribute("aria-hidden", "true");
  xray.append(cover);
  xray.classList.add("on");

  let x = .5, y = .3, goalX = x, goalY = y, heldUntil = 0, inView = false, running = false;
  const aim = e => {
    const r = xray.getBoundingClientRect();
    goalX = (e.clientX - r.left) / r.width;
    goalY = (e.clientY - r.top) / r.height;
    heldUntil = performance.now() + 1500;
  };
  xray.addEventListener("pointermove", aim);
  xray.addEventListener("pointerdown", aim);

  function step(now){
    if (!inView){ running = false; return; }
    if (now > heldUntil){
      goalX = .5 + .24 * Math.sin(now / 1700);
      goalY = .52 + .34 * Math.sin(now / 1100);
    }
    x += (goalX - x) * .12;
    y += (goalY - y) * .12;
    xray.style.setProperty("--x", `${(x * 100).toFixed(2)}%`);
    xray.style.setProperty("--y", `${(y * 100).toFixed(2)}%`);
    requestAnimationFrame(step);
  }
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !running){ running = true; requestAnimationFrame(step); }
  }).observe(xray);
}

// Feedback style examples
const feedback = $("#feedback"), feedbackLine = $("#feedbackLine");
feedback.addEventListener("click", e => {
  const button = e.target.closest("button");
  if (!button) return;
  feedback.querySelectorAll("button").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
  feedbackLine.textContent = button.dataset.line;
});

// Tab title while you're away
const title = document.title;
document.addEventListener("visibilitychange", () => {
  document.title = document.hidden ? "come back. your cv misses you." : title;
});
})();
