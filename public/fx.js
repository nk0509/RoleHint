/* Page effects: the moving smoke behind the top of a page, and sections that sharpen into focus as you scroll.
   Both switch off for people who ask their device for less motion. With no WebGL, the smoke stays a still CSS glow. */
(() => {
"use strict";
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const risers = document.querySelectorAll(".rise");
if (!calm && risers.length){
  document.documentElement.classList.add("fx");
  const watcher = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("seen");
    watcher.unobserve(entry.target);
  }), { rootMargin: "0px 0px -8% 0px" });
  risers.forEach(el => watcher.observe(el));
}

const canvas = document.querySelector(".smoke");
const gl = canvas?.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
if (!gl) return;

const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 size; uniform vec2 aim; uniform float t; uniform vec3 pop;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float cloud(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return v;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * size) / min(size.x, size.y);
  vec2 p = uv * 1.25;
  vec2 pull = aim - uv;
  p += pull * .35 * exp(-3. * dot(pull, pull));
  vec2 q = vec2(cloud(p + t * .05), cloud(p + vec2(5.2, 1.3) - t * .04));
  vec2 w = vec2(cloud(p + 2. * q + vec2(1.7, 9.2) + t * .03), cloud(p + 2. * q + vec2(8.3, 2.8) - t * .02));
  float f = cloud(p + 2.4 * w);
  float band = 1. - abs(fract(f * 2.6 + t * .015) - .5) * 2.;
  float ribbon = pow(band, 9.) * smoothstep(.22, .6, f);
  float haze = smoothstep(.45, .95, f + length(q) * .2) * .42;
  float c = ribbon * 1.7 + haze * .8;
  c *= .3 + .7 * smoothstep(.1, .72, length(uv * vec2(.78, 1.05)));
  c = min(c, .62);
  vec3 silk = mix(mix(vec3(.7), pop, .3), mix(pop, vec3(1.), .08), smoothstep(.2, .62, c));
  gl_FragColor = vec4(mix(vec3(1.), silk, c * .9), 1.);
}`;

function shader(type, source){
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
gl.useProgram(program);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.bindAttribLocation(program, 0, "p");
gl.vertexAttribPointer(gl.getAttribLocation(program, "p"), 2, gl.FLOAT, false, 0, 0);

const uSize = gl.getUniformLocation(program, "size"), uAim = gl.getUniformLocation(program, "aim"), uTime = gl.getUniformLocation(program, "t");

// The smoke uses the --pop colour from styles.css, written there as #rrggbb.
const pop = getComputedStyle(document.documentElement).getPropertyValue("--pop").trim();
gl.uniform3f(gl.getUniformLocation(program, "pop"), ...[1, 3, 5].map(i => parseInt(pop.slice(i, i + 2), 16) / 255));

// Drawn small and stretched by the browser, so the same load runs on a cheap phone and a big screen.
function fit(){
  const w = canvas.clientWidth, h = canvas.clientHeight, shrink = Math.min(1, 640 / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * shrink));
  canvas.height = Math.max(1, Math.round(h * shrink));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uSize, canvas.width, canvas.height);
}
fit();

let aimX = 0, aimY = 0, goalX = 0, goalY = 0;
function frame(seconds){
  aimX += (goalX - aimX) * .06;
  aimY += (goalY - aimY) * .06;
  gl.uniform2f(uAim, aimX, aimY);
  gl.uniform1f(uTime, seconds);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// The canvas starts out black, so paint straight away and after every resize to keep it from flashing on the white page.
function refit(){ fit(); frame(last / 1000 + 40); }
let last = 0;
frame(40);
addEventListener("resize", refit);
if (calm) return;

addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const r = canvas.getBoundingClientRect(), side = Math.min(r.width, r.height);
  goalX = (e.clientX - r.left - r.width / 2) / side;
  goalY = -(e.clientY - r.top - r.height / 2) / side;
});

let onScreen = true, running = false;
function loop(now){
  running = false;
  if (!onScreen || document.hidden) return;
  if (now - last > 33){ last = now; frame(now / 1000 + 40); }
  running = true;
  requestAnimationFrame(loop);
}
function wake(){ if (!running){ running = true; requestAnimationFrame(loop); } }
new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; wake(); }).observe(canvas);
document.addEventListener("visibilitychange", wake);
})();
