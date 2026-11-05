# 🪦 code-cemetery

**Dignified goodbyes for dead code.**

> Finds code nobody calls, deletes it, and writes an obituary commit — because every function deserves a funeral, not a silent `git rm`.

![npm](https://img.shields.io/badge/npm-code--cemetery-c0123f) ![CI](https://img.shields.io/badge/CI-cemetery%20check-24292e) ![license](https://img.shields.io/badge/license-MIT-green) ![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)

---

## 💀 The Problem

Every codebase is a cemetery. Functions written with hope, executed with none. Classes awaiting callers that never came. Utilities that survived three refactors and forgot their purpose.

And now it's worse: **AI assistants mass-produce speculative code** — "comprehensive" helpers, defensive wrappers, `*WithRetry` variants nobody asked for. Humans used to write dead code *accidentally*. Now we generate it *on purpose* and never call it.

`code-cemetery` doesn't just find the graves — it **detects likely AI-born code** 🤖 and gives every deletion the dignity of a proper funeral.

## ✨ Features

| | Feature |
|---|---|
| 🔍 | Detects dead **functions, classes, interfaces, type aliases and whole files** via static analysis (ts-morph) |
| 🤖 | **AI-born detection** — heuristic flags for speculative AI-generated code (naming patterns, defensive wrappers, suspiciously thorough JSDoc) |
| 🪦 | Auto-generated **obituaries** with cause of death, epitaph, and birth date (from git history) |
| 🗺️ | **HTML cemetery map** — a shareable, dark-mode graveyard of your repo with tombstone cards |
| ✅ | **CI gate** (`check`) — fail the build when graves appear, so PRs stop adding dead code |
| ⚙️ | `.cemeteryrc.json` config — scan dirs, ignore globs, sacred names that can never be buried |
| 🧪 | **Dry-run mode** — nothing dies without your review |
| 📝 | Obituary commit messages ready for `git commit -F` |

## 📦 Install

```bash
npm install -g code-cemetery
# or run without installing:
npx code-cemetery scan --dir src
# or from source:
git clone https://github.com/Airtechsolutions-pk/code-cemetery && cd code-cemetery
npm install && npm run build
```

## 🚀 Usage

```bash
# Walk the graveyard (read-only)
code-cemetery scan --dir src

# Read the full obituaries without deleting anything
code-cemetery bury --dir src --dry-run

# Bury them (deletes code + writes obituary commit message file)
code-cemetery bury --dir src

# 🗺️ Generate a shareable HTML cemetery map
code-cemetery map --dir src -o cemetery.html

# ✅ CI mode — exit 1 if graves exceed the limit (gate your PRs)
code-cemetery check --dir src --max 0

# Write a starter .cemeteryrc.json
code-cemetery init
```

## 🪦 Example Obituary

```
🪦  OBITUARY — deepClone

    A function of src/utils/deepClone.ts:3,
    47 lines of sincere intention,
    has passed away, cause of death: AI enthusiasm.

    "Never imported, never forgotten. Well — never imported, anyway."

    Born: 2025-11-02
    🤖  Suspected AI-born (speculative code generated but never called):
        - generic util clone — a classic AI 'comprehensive helper'
        - suspiciously thorough JSDoc on unreferenced code

    Survived by: the 400 other functions that actually get called.
```

## ⚙️ Configuration (`.cemeteryrc.json`)

```json
{
  "dirs": ["src"],
  "ignore": ["**/generated/**", "**/vendor/**"],
  "sacred": ["main", "handler"]
}
```

Ignored by default: test files (`*.test.*`, `*.spec.*`), generated code, `.d.ts` files.
Never buried: entry points (`index`, `main`, `cli`, `server`, `worker`), config files, files with top-level side effects, and **sacred names**.

## 🔒 Safety

- `scan` and `check` never modify anything
- `bury --dry-run` shows every obituary before anything dies — **always review it**
- Entry points and side-effectful files are excluded automatically
- Dynamic reflection / string-based access can be missed by static analysis — run your tests after burial
- The generated commit message file makes every burial auditable in git history

## 🤖 CI Integration

GitHub Actions example — keep the cemetery tidy:

```yaml
name: cemetery-check
on: [pull_request]
jobs:
  graves:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install -g code-cemetery
      - run: code-cemetery check --dir src --max 0
```

Or allow a small budget that shrinks over time:

```yaml
- run: code-cemetery check --dir src --max 5
```

## 🛣️ Roadmap

### v0.3 — Deeper Digging
- [ ] Dead **exports & variables** (currently: functions, classes, interfaces, types, files)
- [ ] Dead **CSS selectors** and unused **dependencies** (package.json gravestones)
- [ ] Untouched **routes/endpoints** (Express/Next.js detectors)
- [ ] `daysUnused` via git blame (graves ranked by how long they've been at rest)

### v0.4 — The Cemetery Grows
- [ ] **Tombstone comments** — leave `🪦 buried by code-cemetery` annotations in git blame history
- [ ] Multi-language support via **tree-sitter** (Go, Python, Rust, Java)
- [ ] Monorepo awareness (workspaces, per-package reports)
- [ ] Interactive TUI — walk the graveyard, choose who dies, arrow keys and all

### v0.5 — Community Edition
- [ ] **Cemetery badge** for your README: `![graves](https://img.shields.io/endpoint?url=...)`
- [ ] GitHub Action — `code-cemetery/action@v1`, posts grave reports on PRs
- [ ] Public cemetery leaderboard: *"most peaceful codebases of the month"* 🕊️
- [ ] VS Code extension — inline tombstone decorations on dead code
- [ ] `.cemeteryrc` presets per framework (Next.js, NestJS, React Native)

### v1.0 — Full Burial Rights
- [ ] Reference-safe auto-delete with type-aware analysis (no false positives)
- [ ] Auto-PR mode: opens a "🪦 funeral PR" with obituaries in the description
- [ ] cemetery.dev — paste a repo URL, get its cemetery map
- [ ] Team analytics: AI-speculation ratio per repo, per developer, over time 📊

## 🤝 Contributing

The cemetery welcomes caretakers.

1. Fork & clone
2. `npm install`
3. `npm run dev -- scan --dir src` (it eats its own dog food 🪦)
4. Add your feature + test, then open a PR titled with a 🪦

Good first issues: extra AI-born heuristics, new epitaphs, new causes of death. Yes, really — the epitaph pool is a legitimate contribution surface.

## ☕ Support the Undertaker

If code-cemetery saved you from deleting things by hand — or saved your build from dead code — consider buying the gravedigger a coffee:

<a href="https://www.buymeacoffee.com/awaisdev">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
</a>

Coffee funds keep the shovel sharp ⛏️ — every cup goes toward multi-language support and the VS Code extension.

## 📜 License

MIT — death is free for everyone.

---

*Made with 🪦 and a slightly dark sense of humor by [Airtechsolutions-pk](https://github.com/Airtechsolutions-pk).*
*"It compiled. That is the kindest thing that can be said."*
