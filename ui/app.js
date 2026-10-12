/**
 * pulse — app.js
 *
 * A full-screen mood dial. The human drags an SVG ring (stroke-dasharray) or
 * uses the keyboard to set a value 0–100 and picks a mode chip; the companion
 * (Doto) reacts via LIP. "Send to Claude" hands the dial over: the engine
 * saves it as a session, closes the window, and `/lets pulse resume` brings
 * it back through the `pulse.load` command.
 *
 * Speaks LIP through /sdk/lets-client.js and mounts the shell
 * (companion, chat, components) through /sdk/lets-shell.js.
 * Plain ES module; no build step; no network beyond the loopback LIP host.
 */
import { Lets } from '/sdk/lets-client.js';
import { Shell } from '/sdk/lets-shell.js';

// ---- state -----------------------------------------------------------------
const MODES = ['calm', 'focused', 'wild'];

let value = 50;                 // what the ring shows right now (moves during an animation)
let target = 50;                // where the dial is settled or heading: an integer 0–100
let mode = 'focused';           // one of MODES

const R = 104;                  // ring radius (matches the SVG)
const C = 2 * Math.PI * R;      // ring circumference
const CENTER = 130;

const STEP = 5;                 // arrow keys
const PAGE_STEP = 10;           // PageUp / PageDown

// ---- LIP + shell -----------------------------------------------------------
// Keep `version` equal to the manifest's.
const lets = Lets.connect({ unique: 'pulse', version: '0.2.0', caps: ['entity', 'chat', 'components'] });
const shell = Shell.mount(lets, {
  root: document.body,
  context: () => ({ value: target, mode }),    // what the companion knows when summoned or clicked
  // Picking it makes the shell emit `entity.pick {id:"explain"}`; Claude answers in chat (see GUIDE).
  quickSuggestions: () => [{ id: 'explain', label: 'What does this value mean?' }],
});

// ---- ring rendering --------------------------------------------------------
const svg = document.getElementById('dial');
const arc = document.getElementById('arc');
const knob = document.getElementById('knob');
const valueText = document.getElementById('valueText');
const chips = Array.from(document.querySelectorAll('.chip'));
const sendBtn = document.getElementById('send');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

arc.style.strokeDasharray = C;

function render() {
  const frac = Math.min(100, Math.max(0, value)) / 100;
  arc.style.strokeDashoffset = C * (1 - frac);
  const a = frac * 2 * Math.PI - Math.PI / 2;   // start at 12 o'clock
  knob.setAttribute('cx', (CENTER + R * Math.cos(a)).toFixed(2));
  knob.setAttribute('cy', (CENTER + R * Math.sin(a)).toFixed(2));
  valueText.textContent = String(Math.round(value));
}

/** Animate the dial to `to` over `ms` (ease-out cubic), then render. No tween when the user prefers reduced motion. */
let animTimer = null;
function animateTo(to, ms = 300) {
  const from = value;
  const t0 = performance.now();
  clearInterval(animTimer);
  if (reduceMotion.matches) { value = to; render(); return; }
  animTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    value = from + (to - from) * (1 - Math.pow(1 - t, 3));
    render();
    if (t >= 1) clearInterval(animTimer);
  }, 16);
}

// ---- value changes (the one place that moves the dial) -----------------------
let emitTimer = null;

/**
 * Move the dial to `v` (rounded, clamped to 0–100). Idempotent: a value the
 * dial already has does nothing. Human changes emit `pulse.value` (debounced
 * 200 ms); pass `quiet` for changes that must not wake Claude (a restore).
 */
function setValue(v, animate, quiet = false) {
  const next = Math.min(100, Math.max(0, Math.round(v)));
  if (next === target) return;
  target = next;
  svg.setAttribute('aria-valuenow', String(target));
  if (animate) animateTo(target);
  else { clearInterval(animTimer); value = target; render(); }
  if (quiet) return;
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => lets.emit('pulse.value', { value: target }), 200);
}

// ---- pointer drag ----------------------------------------------------------
function angleFromEvent(e) {
  const r = svg.getBoundingClientRect();
  const scale = 260 / r.width;
  const x = (e.clientX - r.left) * scale - CENTER;
  const y = (e.clientY - r.top) * scale - CENTER;
  let a = Math.atan2(y, x) + Math.PI / 2;   // 0 at 12 o'clock, clockwise
  if (a < 0) a += 2 * Math.PI;
  return a;
}

let dragging = false;

svg.addEventListener('pointerdown', (e) => {
  dragging = true;
  svg.setPointerCapture(e.pointerId);
  applyDrag(e);
});
svg.addEventListener('pointermove', (e) => { if (dragging) applyDrag(e); });
svg.addEventListener('pointerup', () => { dragging = false; });
svg.addEventListener('pointercancel', () => { dragging = false; });

function applyDrag(e) {
  const a = angleFromEvent(e);
  setValue((a / (2 * Math.PI)) * 100, false);
}

// ---- keyboard (slider pattern: arrows, PageUp/PageDown, Home/End) -------------
const KEY_STEPS = {
  ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP,
  PageUp: PAGE_STEP, PageDown: -PAGE_STEP,
};

svg.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  let next;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = 100;
  else if (Object.hasOwn(KEY_STEPS, e.key)) next = target + KEY_STEPS[e.key];   // from the settled value, so quick presses add up
  else return;
  e.preventDefault();
  setValue(next, true);
});

// ---- mode chips -------------------------------------------------------------
for (const chip of chips) {
  chip.addEventListener('click', () => setMode(chip.dataset.mode));
}

/** Mark the chip for the current mode active (visually and for assistive tech). */
function syncChips() {
  for (const c of chips) {
    const on = c.dataset.mode === mode;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  }
}

/** Switch mode. `quiet` skips the `pulse.mode` event (used by a restore). */
function setMode(m, quiet = false) {
  if (!MODES.includes(m) || m === mode) return;
  mode = m;
  syncChips();
  if (!quiet) lets.emit('pulse.mode', { mode });
}

// ---- Send to Claude -----------------------------------------------------------
sendBtn.addEventListener('click', sendToClaude);

/**
 * "Send to Claude": pulse.export with the dial's state. The engine saves it as
 * a session and (by default) asks this window to close; Claude answers in the
 * Claude Code chat, and `/lets pulse resume` brings the dial back via `pulse.load`.
 */
function sendToClaude() {
  clearTimeout(emitTimer);                 // the export carries the value; drop the pending pulse.value
  lets.emitNow('pulse.export', { label: `${mode} · ${Math.round(target)}`, value: target, mode });   // `label` gives the saved session its summary
  if (lets.status !== 'open') { shell.toast('Not connected to the lets host. The dial is kept and sent when the connection is back.', 'warn', 4500); return; }
  shell.toast('Sent to Claude.', 'ok', 2200);
  if (shell.listening === false) shell.toast('Doto is away. Claude reads this with your next message in Claude Code.', 'info', 4500);
}

// ---- commands from Claude ----------------------------------------------------
lets.on('pulse.set', (data) => {
  const v = Number(data && data.value);
  if (Number.isFinite(v)) setValue(v, true);
});
lets.on('pulse.glow', (data) => {
  const color = data && data.color ? String(data.color) : 'var(--lets-accent)';
  const ttl = Number(data && data.ttl) || 1200;
  glow(color, ttl);
});

// The restore command named in the manifest's `session` block. The engine queues it
// with the saved export payload when Claude calls `open {resume}`. Animated,
// idempotent, and silent: restoring state is not the human doing something.
lets.on('pulse.load', (data, msg) => {
  const d = data && typeof data === 'object' ? data : {};
  const hasValue = typeof d.value === 'number' && Number.isFinite(d.value);
  const hasMode = MODES.includes(d.mode);
  if (!hasValue && !hasMode) {
    lets.emit('lip.error', { code: 'bad_request', message: 'pulse.load: expected {value?: 0-100, mode?: calm|focused|wild}', re: msg?.id });
    return;
  }
  if (hasValue) setValue(d.value, true, true);
  if (hasMode) setMode(d.mode, true);
});

// The manifest's `session.snapshot`: reply with the current state, tagged `re` = the command id.
lets.on('pulse.snapshot', (_data, msg) => {
  lets.emitNow('pulse.snapshot', { value: target, mode }, msg?.id ? { re: msg.id } : undefined);
});

/** Temporarily recolor the ring arc + knob glow, then restore. */
let glowTimer = null;
function glow(color, ttl) {
  svg.style.setProperty('--glow-color', color);
  svg.classList.add('glowing');
  clearTimeout(glowTimer);
  glowTimer = setTimeout(() => {
    svg.classList.remove('glowing');
    svg.style.removeProperty('--glow-color');     // back to the theme accent
  }, ttl);
}

// ---- boot ---------------------------------------------------------------------
render();
syncChips();
