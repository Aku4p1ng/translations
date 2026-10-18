#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { LANGUAGE_NAMES, SOURCE_LOCALE, completeness, leaves, listLocales, percent, readLocale } from './lib/i18n.mjs'

const { values: args } = parseArgs({ options: { 'write-readme': { type: 'boolean', default: false } } })

const sourceLeaves = leaves(readLocale('locales', SOURCE_LOCALE))
const rows = listLocales('locales')
  .filter((locale) => locale !== SOURCE_LOCALE)
  .map((locale) => ({ locale, ...completeness(sourceLeaves, readLocale('locales', locale)) }))
  .sort((a, b) => b.translated - a.translated || a.locale.localeCompare(b.locale))

const total = sourceLeaves.size
const table = [
  '| Locale | Language | Translated | Complete |',
  '| ------ | -------- | ---------- | -------- |',
  `| \`${SOURCE_LOCALE}\` | ${LANGUAGE_NAMES[SOURCE_LOCALE]} (source) | ${total} / ${total} | 100% |`,
  ...rows.map(({ locale, translated, total }) =>
    `| \`${locale}\` | ${LANGUAGE_NAMES[locale] ?? locale} | ${translated} / ${total} | ${percent(translated, total)}% |`)
].join('\n')

if (!args['write-readme']) {
  console.log(table)
} else {
  const readme = readFileSync('README.md', 'utf8')
  const updated = readme.replace(
    /(<!-- BEGIN COMPLETENESS TABLE -->)[\s\S]*?(<!-- END COMPLETENESS TABLE -->)/,
    `$1\n${table}\n$2`
  )
  writeFileSync('README.md', updated)
}
