#!/usr/bin/env node
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  SOURCE_LOCALE,
  changedLeaves,
  getLeaf,
  git,
  readLocales,
  readLocalesAt,
  setLeaf,
  shape,
  writeLocale
} from './lib/i18n.mjs'

const APP_LOCALES = 'frontend/src/i18n/locales'
const TRANSLATIONS_LOCALES = 'locales'

const { positionals, values: args } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: 'string' },
    translations: { type: 'string' },
    before: { type: 'string', default: '' }
  }
})

const [direction] = positionals
if (!['from-app', 'to-app'].includes(direction) || !args.app || !args.translations) {
  console.error('usage: node scripts/sync.mjs <from-app|to-app> --app <repo> --translations <repo> --before <commit>')
  process.exit(2)
}

function fromApp (before, after, target) {
  const merged = target[SOURCE_LOCALE] ?? {}
  for (const { path, value } of changedLeaves(before[SOURCE_LOCALE], after[SOURCE_LOCALE])) setLeaf(merged, path, value)
  const source = shape(after[SOURCE_LOCALE], merged, (value) => value)
  target[SOURCE_LOCALE] = source

  for (const locale of new Set([...Object.keys(after), ...Object.keys(target)])) {
    if (locale === SOURCE_LOCALE) continue
    const tree = target[locale] ?? {}
    const changes = changedLeaves(before[locale], after[locale])
    for (const { path, value } of changes) setLeaf(tree, path, value ?? null)
    target[locale] = shape(source, tree, null)
    if (changes.length) console.log(`${locale}: ${changes.length} key(s) from the app`)
  }
}

function toApp (before, after, target) {
  const source = target[SOURCE_LOCALE]
  for (const locale of Object.keys(after)) {
    const changes = changedLeaves(before[locale], after[locale])
      .filter(({ path, value }) => getLeaf(source, path) !== undefined && (locale !== SOURCE_LOCALE || value != null))
    if (!changes.length) continue
    if (!target[locale]) {
      console.warn(`${locale}: not registered in the app, skipped`)
      continue
    }
    for (const { path, value } of changes) setLeaf(target[locale], path, value ?? undefined)
    target[locale] = shape(source, target[locale], undefined)
    console.log(`${locale}: ${changes.length} key(s) to the app`)
  }
}

const app = { repo: resolve(args.app), dir: APP_LOCALES, branch: 'translations/update' }
const translations = { repo: resolve(args.translations), dir: TRANSLATIONS_LOCALES, branch: 'sync/app' }
const [from, to, apply] = direction === 'from-app' ? [app, translations, fromApp] : [translations, app, toApp]

const after = readLocales(join(from.repo, from.dir))
const before = readLocalesAt(from.repo, args.before, from.dir) ?? after
const target = readLocales(join(to.repo, to.dir))

const pending = readLocalesAt(to.repo, `origin/${to.branch}`, to.dir)
if (pending) {
  const base = git(to.repo, 'merge-base', 'origin/main', `origin/${to.branch}`).trim()
  apply(readLocalesAt(to.repo, base, to.dir) ?? pending, pending, target)
}
apply(before, after, target)

for (const [locale, tree] of Object.entries(target)) writeLocale(join(to.repo, to.dir), locale, tree)
