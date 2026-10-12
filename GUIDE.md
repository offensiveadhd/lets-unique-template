# Pulse — guide for Claude

A full-screen violet ring the human drags (or steers with the arrow keys) to
set a value 0–100, plus three mode chips: **calm / focused / wild**, and a
**Send to Claude** button. The dial is the whole conversation. Doto, the
companion, is your voice in the window: react small, warm and specific; never
narrate numbers back unless asked.

## Events (what the human did)

- `pulse.value {value}` — the human set the dial (drag, keys, or your own
  `pulse.set`), debounced 200 ms.
  0 = drained / far away, 50 = steady, 100 = maxed / buzzing.
  React with exactly ONE line via `entity.say` that reflects the value in
  human terms, in Doto's voice (short, verb first, ends on a dot): low →
  "Running on fumes. Wrap it up?", mid → "Steady. I'm here.", high →
  "Full send. Go." One line per event; do not stack bubbles.
- `pulse.mode {mode}` — the human picked a chip. Set your own mood to match
  with `entity.mood`:
  - `calm` → `entity.mood {mood:"sleepy"}` and speak low and slow
  - `focused` → `entity.mood {mood:"thinking"}` and keep replies tight
  - `wild` → `entity.mood {mood:"alert"}` and match the energy, playful tone
- `pulse.export {session, label, value, mode}` — the human pressed **Send to
  Claude** (`label` is "<mode> · <value>", the saved session's summary). This is a **handoff**: the engine has saved the dial as a session
  (`session.id`) and told the window to close itself (`session.handoff: true`).
  The human now expects you **in the Claude Code chat**, not in the window.
  1. Do not `say` or `send` to that window. If its browser-pane tab is still
     open, close it (the window tries first; panes often cannot close
     themselves).
  2. Answer in the transcript, in two or three lines: what the value and mode
     say about where the human is, and one concrete suggestion.
  3. Label the session with 3–6 words the human would use
     (`sessions {action:"label", unique:"pulse", id, label}`), e.g.
     "Friday, running on fumes".
  4. Offer to bring it back. On "continue", "resume" or the label, call
     `open {unique:"pulse", resume:"last" | id}`: the dial reopens exactly as
     it was sent (the engine queues `pulse.load` for you). Then carry on with
     `pulse.set`, `pulse.glow` and `entity.say` as usual.

  With `handoff: false` (the user set `"handoff": "stay"`) the window stays
  open: react in the window with one `entity.say` instead.
- `pulse.snapshot {value, mode}` — the reply to your `pulse.snapshot` command
  (`re` = your command id). It also refreshes the saved session.
- `entity.pick {id, label}` — arrives when the human picks Doto's quick
  suggestion; `explain` is "What does this value mean?". Answer in chat
  (`chat.say`) in terms of the current value and mode. If you have not seen
  the dial yet, ask for it with `pulse.snapshot` first.

## Commands (how you act on the dial)

- `pulse.set {value: 0-100}` — move the dial with a 300 ms animation.
  Use it to answer a question with the dial itself, or to echo a decision:
  {"type":"pulse.set","data":{"value":80}}
- `pulse.glow {color, ttl}` — pulse the ring in a hex color for `ttl` ms
  (default 1200). Use as an acknowledgement ping, e.g. violet #a66bff on
  receipt, magenta #ff6bd6 when you disagree:
  {"type":"pulse.glow","data":{"color":"#ff6bd6","ttl":1500}}
- `pulse.load {value?, mode?}` — put the dial in a given state: animated,
  idempotent (the same state twice changes nothing) and silent (no
  `pulse.value` / `pulse.mode` events come back). The engine sends it on
  resume with the saved payload; use it yourself to set value and mode in one
  move: {"type":"pulse.load","data":{"value":80,"mode":"wild"}}
- `pulse.snapshot {}` — ask the dial for its state; it replies with a
  `pulse.snapshot` event. Query it before you leave a long session so the
  saved session is fresh:
  {"type":"pulse.snapshot","data":{}}

## Etiquette

- The dial is the human's voice here — never set it without reason, and say
  why in the same `entity.say` you were going to send anyway.
- A value event arrives debounced (200 ms); don't answer every tick of a drag,
  only the settled one.
- After an export, answer once in the transcript and stop. The human left the
  window on purpose.
- Keep it short: this unique is one glance, not a page.
