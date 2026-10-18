#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  SOURCE_LOCALE,
  checkMessage,
  completeness,
  getLeaf,
  isGroup,
  leaves,
  listLocales,
  pluralForms,
  serialize,
  shape,
  writeLocale
} from './lib/i18n.mjs'

const { values: args } = parseArgs({
  options: {
    root: { type: 'string', default: '.' },
    fix: { type: 'boolean', default: false },
    base: { type: 'string' },
    'allow-en-us-change': { type: 'boolean', default: false }
  }
})

const root = resolve(args.root)
const localesDir = join(root, 'locales')
const errors = []
const warnings = []

function parse (locale) {
  const raw = readFileSync(join(localesDir, `${locale}.json`), 'utf8')
  try {
    return { raw, tree: JSON.parse(raw) }
  } catch (error) {
    errors.push(`${locale}: invalid JSON (${error.message})`)
    return { raw }
  }
}

const locales = listLocales(localesDir)
if (!locales.includes(SOURCE_LOCALE)) {
  console.error(`✖ locales/${SOURCE_LOCALE}.json is missing`)
  process.exit(1)
}

const { raw: sourceRaw, tree: source } = parse(SOURCE_LOCALE)
if (!source) {
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

for (const [key, { value }] of leaves(source)) {
  const valid = typeof value === 'string' || (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  if (!valid) errors.push(`${SOURCE_LOCALE}: key "${key}" must be a string or a list of strings`)
}
if (sourceRaw !== serialize(source)) {
  errors.push(`${SOURCE_LOCALE}: not canonically formatted (2-space indent, LF, trailing newline)`)
}

if (args.base && !args['allow-en-us-change']) {
  try {
    execFileSync('git', ['diff', '--quiet', args.base, '--', `locales/${SOURCE_LOCALE}.json`], { cwd: root })
  } catch {
    errors.push(`${SOURCE_LOCALE}: changed in this pull request. The source language comes from the app, please open an issue instead`)
  }
}

const report = []

for (const locale of locales.filter((code) => code !== SOURCE_LOCALE)) {
  const { raw, tree } = parse(locale)
  if (!tree) continue
  if (!isGroup(tree)) {
    errors.push(`${locale}: must be a JSON object`)
    continue
  }

  const sourceLeaves = leaves(source)
  const localeLeaves = leaves(tree)

  for (const [key, { path, value }] of localeLeaves) {
    const sourceValue = getLeaf(source, path)
    if (sourceValue === undefined) {
      errors.push(`${locale}: key "${key}" does not exist in ${SOURCE_LOCALE}`)
      continue
    }
    if (value === null) continue

    if (Array.isArray(sourceValue)) {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        errors.push(`${locale}: key "${key}" must be a list of strings or null`)
      } else if (value.length !== sourceValue.length) {
        errors.push(`${locale}: key "${key}" has ${value.length} entries, ${SOURCE_LOCALE} has ${sourceValue.length}`)
      } else {
        value.forEach((entry, index) => {
          for (const problem of checkMessage(sourceValue[index], entry)) errors.push(`${locale}: key "${key}[${index}]" ${problem}`)
        })
      }
      continue
    }

    if (typeof value !== 'string') {
      errors.push(`${locale}: key "${key}" must be a string or null`)
      continue
    }
    for (const problem of checkMessage(sourceValue, value)) errors.push(`${locale}: key "${key}" ${problem}`)
    if (pluralForms(sourceValue) > 1 && pluralForms(value) !== pluralForms(sourceValue)) {
      warnings.push(`${locale}: key "${key}" has ${pluralForms(value)} plural form(s), ${SOURCE_LOCALE} has ${pluralForms(sourceValue)}`)
    }
  }

  for (const [key, { path }] of sourceLeaves) {
    const value = getLeaf(tree, path)
    if (value === undefined) {
      if (!args.fix) errors.push(`${locale}: key "${key}" is missing (fixable with --fix)`)
    }
    else if (isGroup(value)) errors.push(`${locale}: key "${key}" must not be an object`)
  }

  const canonical = serialize(shape(source, tree, null))
  if (raw !== canonical) {
    if (args.fix) {
      writeLocale(localesDir, locale, shape(source, tree, null))
      console.log(`fixed ${locale}`)
    } else {
      errors.push(`${locale}: formatting or key order differs from ${SOURCE_LOCALE} (fixable with --fix)`)
    }
  }

  report.push({ locale, ...completeness(source, shape(source, tree, null)) })
}

console.log(`\nCompleteness (against ${SOURCE_LOCALE})\n`)
for (const { locale, translated, total } of report) {
  const percent = total === 0 ? 100 : Math.round((translated / total) * 100)
  const bar = '█'.repeat(Math.round(percent / 5)).padEnd(20, '░')
  console.log(`  ${locale}  ${bar}  ${String(percent).padStart(3)}%  (${translated}/${total})`)
}

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} warning(s):\n`)
  for (const warning of warnings) console.log(`  ${warning}`)
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} error(s):\n`)
  for (const error of errors) console.error(`  ${error}`)
  console.error('')
  process.exit(1)
}

console.log('\n✔ All locales valid.\n')
