# lets-unique-template — "pulse"

A minimal but complete **unique** for [lets](https://github.com/offensiveadhd/lets):
a full-screen dark-violet mood dial. The human drags a ring (or uses the arrow
keys) to set a value 0–100 and picks one of three mode chips (calm / focused /
wild); Doto, the companion, reacts and Claude can move the dial itself. It
demonstrates the entire unique contract — manifest, guide, static UI, LIP
events and commands, and the session block (handoff and resume) — in a handful
of files you can rename and build on.

Use it as a GitHub **template repo**: "Use this template" → name it
`lets-unique-<name>` → clone → rename `pulse` everywhere (manifest `name`,
`domains`, `session`, event/command types, `data-unique`, `Lets.connect`,
`package.json`, GUIDE) → build.

## Local development

Uniques are served by the lets host, never opened from disk. Put this
folder where the host looks for uniques (a real folder: the host does not
follow symlinks or junctions):

- project-local: `<project>/.lets/uniques/pulse`
- or global: `~/.lets/uniques/pulse`
- or anywhere, by pointing `LETS_UNIQUES_DIRS` at the folder that contains
  this one (several folders are separated by `;` on Windows, `:` elsewhere)

then run the host standalone from your checkout of the lets repo (`<lets>`
below is that checkout):

    node <lets>/engine/bin/lets.mjs serve --open pulse --verbose

It starts the loopback server, serves the SDK at `/sdk/…`, your folder at
`/u/pulse/…`, opens the window, and with `--verbose` prints every event your UI
emits. Console errors = something is wrong; the quality bar is zero console
errors in Chromium/Edge.

Validate before every push:

    npm run validate                              # scripts/validate.mjs, no install needed
    node <lets>/engine/bin/lets.mjs validate .    # the host's own check

`npm run validate` checks `unique.json` against the vendored manifest schema,
that `entry`, `guide` and `icon` exist, that no reserved domain is used, and
that `GUIDE.md` is not too long. The GitHub Actions workflow runs it on every
push and pull request, together with `node --check` on `ui/*.js`.

## Try the handoff

The template shows "Send to Claude" the way the engine expects it:

1. Set the dial, pick a mode, press **Send to Claude**. The UI emits
   `pulse.export {value, mode}`.
2. The engine saves it as a session, the window says goodbye and closes, and
   Claude answers in the Claude Code chat (see `GUIDE.md`).
3. `/lets pulse resume` reopens the window; the engine queues `pulse.load` with
   the saved payload and the dial comes back as you sent it.

If Claude is not listening, the UI says so ("Doto is away…") and Claude reads
the export with your next message.

## File layout — what every file is for

    unique.json        the manifest: name, version, entry, engine, domains,
                       events, commands, permissions, session, tags.
                       Schema-validated by the host BEFORE the unique is
                       served. This is the contract.
    GUIDE.md           prose for Claude: what each event means and how to
                       react, what commands exist, handoff etiquette. The
                       `open` tool returns it. Keep it under ~1,200 words.
    icon.svg           64×64 violet ring shown in listings.
    ui/index.html      the entry page; <body data-unique="pulse">.
    ui/app.js          the unique logic: ring drag and keyboard, chips,
                       Send to Claude, LIP wiring.
    ui/style.css       deep-violet theme; re-declares the --lets-* variables
                       so it survives a missing shell CSS.
    package.json       npm metadata and the `validate` script. No dependencies.
    scripts/validate.mjs
                       zero-dependency manifest check; what `npm run validate`
                       and CI run.
    schemas/unique.schema.json
                       the LIP manifest schema, vendored from the lets repo
                       (protocol/schemas/) so validation works offline.
    .github/workflows/validate.yml
                       CI: validate the manifest, syntax-check the UI.
    CHANGELOG.md       what changed in each version.
    LICENSE            MIT.

## How the UI talks LIP

Every unique does exactly this (see `ui/app.js`):

    import { Lets } from '/sdk/lets-client.js';
    import { Shell } from '/sdk/lets-shell.js';

    const lets  = Lets.connect({ unique: 'pulse', version: '0.2.0',
                                 caps: ['entity', 'chat', 'components'] });
    const shell = Shell.mount(lets, {
      root: document.body,
      context: () => ({ value, mode }),            // what the entity knows
      quickSuggestions: () => [{ id: 'explain', label: 'What does this value mean?' }],
    });

    lets.emit('pulse.value', { value });           // an event up to Claude
    lets.on('pulse.set', (data, msg) => { … });    // a command down from Claude

Checklist your UI must satisfy:

- `<body data-unique="<name>">` in the entry HTML.
- Everything is a static ES module; no build step, no CDN, no bundler, no
  inline `<script>` (the host sends a strict CSP).
- Emit events with `lets.emit('<domain>.<thing>', data)` — types must start
  with a domain you declared in the manifest. Use `lets.emitNow(…)` for the
  export, which should leave before the window closes.
- Handle your own commands with `lets.on('<domain>.<cmd>', (data, msg) => …)`.
  Answer a query command with an event whose envelope carries `re: msg.id`
  (`lets.emitNow(type, data, { re: msg.id })`).
- Leave `entity.*`, `chat.*`, `component.*`, `ui.*` and `session.*` to the
  shell — it wires them itself; never re-implement them.
- Declare permissions (`fs.write`, `net`) honestly in the manifest; the host
  enforces them and shows them to the user.
- Make everything reachable by keyboard and labelled: the dial is a
  `role="slider"` with `tabindex`, `aria-value*`, arrow / Page / Home / End
  keys and a visible focus ring; the chips are buttons with `aria-pressed`.
  Keep your `prefers-reduced-motion` rule.

## The session block (handoff and resume)

`unique.json` names the three message types the engine needs to save and bring
back a window:

    "session": { "export": "pulse.export", "snapshot": "pulse.snapshot", "restore": "pulse.load" }

- **export** — an event your UI emits when the human presses "Send to Claude".
  The engine saves its data as a session (`~/.lets/sessions/<name>/`), adds
  `session: {id, handoff, …}` to it, and closes the window.
- **snapshot** — the reply to a snapshot command (`re` = the command id). The
  engine uses it to refresh the saved session silently.
- **restore** — a command that rebuilds the window from a saved payload.
  Make it animated, idempotent, and silent (it must not emit the events a
  human action would, or Claude will answer its own resume).

Without the block the engine assumes `<name>.export`, `<name>.snapshot` and
`<name>.load`. Declare it anyway, as here: it is the documentation. Requires
`"engine": ">=0.4.0"`.

## Versions

- Bump `version` in `unique.json` whenever you change events or commands (a
  new feature is a minor bump, a fix a patch), and keep `package.json` and the
  `version` in `Lets.connect(…)` equal to it.
- Add an entry to `CHANGELOG.md` with the same number.
- Change `engine` when you start using a newer host feature.

## Publishing

1. Push your repo to GitHub (public, or a URL the user can clone).
2. Validate locally: `npm run validate`, and
   `node <lets>/engine/bin/lets.mjs validate .`
3. Open a PR against the `lets-store` repo adding an entry to its
   `index.json`:

       { "name": "pulse", "title": "Pulse — a dial you talk through",
         "description": "…", "repo": "https://github.com/you/lets-unique-pulse.git",
         "path": "", "ref": "main", "sha": "<commit>", "tags": ["mood", "dial"],
         "author": "you" }

   `path` is `""` when `unique.json` sits at the repo root. Pin a `sha`
   (optionally `manifestSha256` too). Follow that repo's CONTRIBUTING.md
   checklist. A maintainer reviews the manifest and marks the entry verified.

## The rules

- Static only: the host serves files, it never executes your code.
- Domains must be yours: `pulse.*` here; never reserved domains
  (`lip`, `session`, `entity`, `chat`, `component`, `media`, `ui`, `host`,
  `claude`).
- Keep `GUIDE.md` short (under ~1,200 words); it is read on every window open.
- Declare permissions even when empty — `"fs.write": []` means "writes nothing".
- Bump `version` (see Versions) whenever you change events/commands.

## License

MIT — see `LICENSE`.
