#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { LANGUAGE_NAMES, SOURCE_LOCALE, completeness, listLocales, readLocale, shape } from './lib/i18n.mjs'

const { values: args } = parseArgs({ options: { 'write-readme': { type: 'boolean', default: false } } })

const source = readLocale('locales', SOURCE_LOCALE)
const rows = listLocales('locales')
  .filter((locale) => locale !== SOURCE_LOCALE)
  .map((locale) => ({ locale, ...completeness(source, shape(source, readLocale('locales', locale), null)) }))
  .sort((a, b) => b.translated - a.translated || a.locale.localeCompare(b.locale))

const total = rows[0]?.total ?? 0
const table = [
  '| Locale | Language | Translated | Complete |',
  '| ------ | -------- | ---------- | -------- |',
  `| \`${SOURCE_LOCALE}\` | ${LANGUAGE_NAMES[SOURCE_LOCALE]} (source) | ${total} / ${total} | 100% |`,
  ...rows.map(({ locale, translated, total }) =>
    `| \`${locale}\` | ${LANGUAGE_NAMES[locale] ?? locale} | ${translated} / ${total} | ${total ? Math.floor((translated / total) * 1000) / 10 : 100}% |`)
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
