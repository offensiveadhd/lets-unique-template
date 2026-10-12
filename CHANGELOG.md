# Changelog

## 0.2.0 — 2026-10-13

- **Keyboard-accessible dial.** The slider is now focusable (`tabindex="0"`)
  and carries `aria-valuemin/max/now` and a real `aria-label`. Arrows move by
  5, PageUp/PageDown by 10, Home/End jump to 0/100, with a visible focus ring.
  The hint reads "drag the ring or use the arrow keys". Mode chips are a
  labelled group with `aria-pressed`, and the initial mode (`focused`) is
  marked active on load.
- **Session block (handoff and resume).** `unique.json` declares
  `session: {export: pulse.export, snapshot: pulse.snapshot, restore: pulse.load}`
  and `engine: ">=0.4.0"`. New events `pulse.export` and `pulse.snapshot`, new
  commands `pulse.load` and `pulse.snapshot`, and a **Send to Claude** button.
  The engine saves the dial, closes the window, and `/lets pulse resume`
  brings it back. GUIDE covers handoff etiquette, load and snapshot.
- **Scaffolding.** `package.json` (`npm run validate`), `scripts/validate.mjs`,
  the vendored `schemas/unique.schema.json`, a GitHub Actions workflow that
  validates the manifest and syntax-checks the UI, and this changelog.
- **README fixes.** No machine-specific path (`<lets>` is your checkout), the
  companion is Doto, the file layout and version rules are current.
- Manifest: `tags`, summaries with payload shapes. `pulse.export` carries a
  `label` ("<mode> · <value>") so the saved session lists with a summary.

## 0.1.0 — 2026-10-10

First template: the pulse dial with three mode chips, `pulse.value` /
`pulse.mode` events, `pulse.set` / `pulse.glow` commands, GUIDE and README.
