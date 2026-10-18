#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  SOURCE_LOCALE,
  changedLeaves,
  getLeaf,
  listLocales,
  readLocale,
  setLeaf,
  shape,
  writeLocale
} from './lib/i18n.mjs'

const { positionals, values: args } = parseArgs({
  allowPositionals: true,
  options: {
    before: { type: 'string' },
    after: { type: 'string' },
    target: { type: 'string' }
  }
})

const [direction] = positionals
if (!['from-app', 'to-app'].includes(direction) || !args.before || !args.after || !args.target) {
  console.error('usage: node scripts/sync.mjs <from-app|to-app> --before <dir> --after <dir> --target <dir>')
  process.exit(2)
}

const beforeDir = resolve(args.before)
const afterDir = resolve(args.after)
const targetDir = resolve(args.target)
mkdirSync(targetDir, { recursive: true })

function fromApp () {
  const source = readLocale(afterDir, SOURCE_LOCALE)
  if (!source) throw new Error(`${afterDir} has no ${SOURCE_LOCALE}.json`)
  writeLocale(targetDir, SOURCE_LOCALE, source)

  const locales = new Set([...listLocales(afterDir), ...listLocales(targetDir)])
  locales.delete(SOURCE_LOCALE)

  for (const locale of locales) {
    const tree = readLocale(targetDir, locale) ?? {}
    const changes = changedLeaves(readLocale(beforeDir, locale), readLocale(afterDir, locale))
    for (const { path, value } of changes) setLeaf(tree, path, value ?? null)
    writeLocale(targetDir, locale, shape(source, tree, null))
    if (changes.length) console.log(`${locale}: ${changes.length} key(s) from the app`)
  }
}

function toApp () {
  const source = readLocale(targetDir, SOURCE_LOCALE)
  if (!source) throw new Error(`${targetDir} has no ${SOURCE_LOCALE}.json`)
  const appLocales = new Set(listLocales(targetDir))

  for (const locale of listLocales(afterDir)) {
    if (locale === SOURCE_LOCALE) continue
    const changes = changedLeaves(readLocale(beforeDir, locale), readLocale(afterDir, locale))
      .filter(({ path }) => getLeaf(source, path) !== undefined)
    if (!changes.length) continue
    if (!appLocales.has(locale)) {
      console.warn(`${locale}: not registered in the app, skipped`)
      continue
    }
    const tree = readLocale(targetDir, locale)
    for (const { path, value } of changes) setLeaf(tree, path, value ?? undefined)
    writeLocale(targetDir, locale, shape(source, tree, undefined))
    console.log(`${locale}: ${changes.length} key(s) to the app`)
  }
}

if (direction === 'from-app') fromApp()
else toApp()
