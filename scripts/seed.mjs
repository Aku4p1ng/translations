#!/usr/bin/env node
import { resolve } from 'node:path'
import { SOURCE_LOCALE, getLeaf, leaves, listLocales, readLocale, setLeaf, shape, writeLocale } from './lib/i18n.mjs'

const [appDir] = process.argv.slice(2)
if (!appDir) {
  console.error('usage: node scripts/seed.mjs <app locales dir>')
  process.exit(2)
}

const from = resolve(appDir)
const target = resolve('locales')
const source = readLocale(from, SOURCE_LOCALE)
writeLocale(target, SOURCE_LOCALE, source)

for (const locale of listLocales(from).filter((code) => code !== SOURCE_LOCALE)) {
  const tree = shape(source, readLocale(from, locale), null)
  let filler = 0
  for (const { path, value } of leaves(tree).values()) {
    if (typeof value === 'string' && value.includes(' ') && value === getLeaf(source, path)) {
      setLeaf(tree, path, null)
      filler++
    }
  }
  writeLocale(target, locale, tree)
  console.log(`${locale}: seeded, ${filler} English filler value(s) set to null`)
}
