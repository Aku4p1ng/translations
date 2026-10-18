# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## What this repository is

The public translations repository of OutlastTrialsStats (TOTStats), a community stats platform for "The Outlast Trials". It replaces Crowdin. The website itself lives in the private repo `OutlastTrialsStats/OutlastTrialsStats`, which bundles the locale files under `frontend/src/i18n/locales/` (vue-i18n). The community translates here through pull requests.

**All translation work for TOTStats goes through this repository.** Do not hand-edit the non-English locales in the app repo to get a translation in; open a pull request here instead. (The app maintainer may change strings directly in the app while building a feature; those changes come back here automatically, see below.)

## Data flow

```
 app repo (private)                          this repo (public)
 frontend/src/i18n/locales/*.json            locales/*.json
        │  push to main                             ▲
        └── translations-sync.yml ──► PR sync/app ──┘   en-US + keys the app changed
                                                        community PRs ──► main
        ┌── PR translations/update ◄── sync-to-app.yml ─┘   keys changed on main
        ▼
 merged by the maintainer, deployed with the app
```

- `en-US.json` is owned by the app. It only changes here through the `sync/app` pull request. Community pull requests that touch it fail CI.
- The other locales are owned by this repo. The app maintainer may still edit them in the app (for example a German string while building a feature); the `sync/app` PR carries those keys over.
- Both directions transfer **only the keys that changed** in the triggering push (`scripts/sync.mjs`, comparing the old against the new state). A sync therefore never resets a value that is still waiting in the other direction. An open bot PR is carried over: each run rebuilds it from `main` plus the keys that branch already changed.
- Merges of the bot PRs themselves do not trigger the opposite sync (matched by commit message), so a value cannot bounce back.

## Format

- One JSON file per locale in `locales/`, nested objects like the vue-i18n messages, 2-space indent, LF, trailing newline, keys in the order of `en-US.json`.
- Every locale has every key of `en-US.json`. Untranslated is `null`; the app falls back to English. In the app repo untranslated keys are omitted instead, `sync.mjs to-app` drops them.
- Values are strings or `null`. Lists (arrays of strings) are all or nothing: fully translated with the same length, or `null`.
- vue-i18n syntax: `{placeholder}` interpolation, `|` separates plural forms.
- `scripts/seed.mjs` created the initial files from the app and set English filler (values identical to en-US that contain a space) to `null`. That was a one-time step; do not run it again, an identical value is now a deliberate choice.

## Scripts

Plain Node ≥ 20, no dependencies, never `import()` a locale file (they come from strangers, only `JSON.parse`).

- `scripts/lib/i18n.mjs` — shared helpers (leaves, shape, canonical serialization, placeholder/HTML checks).
- `scripts/validate.mjs [--root <dir>] [--fix] [--base <ref>] [--allow-en-us-change]` — errors: invalid JSON, unknown or missing keys, wrong types, list length, placeholder mismatch, HTML not in en-US, non-canonical formatting, en-US changed against `--base`. Warning: different number of plural forms. `--fix` rewrites into canonical shape (adds missing keys as `null`, drops unknown keys).
- `scripts/sync.mjs from-app|to-app --before <dir> --after <dir> --target <dir>` — used by the workflows, see Data flow.
- `scripts/status.mjs [--write-readme]` — completeness table, written into README by the `sync/app` PR.

## CI and security

This repo receives pull requests from strangers.

- `validate.yml` runs on `pull_request` with `contents: read`, no secrets, and runs the validator **from the base commit** (`tooling/`), so a PR cannot weaken the checks it is judged by. Never switch it to `pull_request_target`.
- `--allow-en-us-change` only applies to the `sync/app` branch of this repository itself.
- `sync-to-app.yml` runs only on pushes to `main` and is the only workflow with a secret (`TRANSLATIONS_SYNC_TOKEN`, fine-grained PAT with contents + pull request write on both repos). It runs the scripts from `main`, so changes to `scripts/` need the same care as a code review.
- `main` is protected: the Validate check is required, no direct pushes.

## Reviewing translation PRs

- One locale per PR is preferred; many locales at once usually means machine translation.
- Reject bulk machine-translation dumps. Spot-check game terms (Rigs, Trials, Reagents, Prestige, Invasion; glossary in CONTRIBUTING.md) against the in-game localization.
- New translations should match the tone and terminology already used in that file.
- Never merge with red CI. If only formatting fails (contributors using the web editor cannot run `--fix`), push the fix to their branch instead of bouncing the PR.

## What not to do

- Do not edit `locales/en-US.json` by hand here; change the string in the app repo.
- Do not add a new locale here alone: it must also be registered in the app (`frontend/src/i18n/index.js`), otherwise `sync.mjs to-app` skips it. Add it to `LANGUAGE_NAMES` in `scripts/lib/i18n.mjs` and create the file with `{}` plus `--fix`.
- Do not auto-translate with an LLM or MT service and commit the result. Human translations only.
- Do not replace `null` with the English text.
- Do not add app code, API details or anything else from the private repo. Only the strings are public.
- Do not add dependencies or a build step.
