#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  SOURCE_LOCALE,
  checkValue,
  completeness,
  getLeaf,
  git,
  isGroup,
  leaves,
  listLocales,
  percent,
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

function report (locale, result) {
  errors.push(...result.errors.map((error) => `${locale}: ${error}`))
  warnings.push(...result.warnings.map((warning) => `${locale}: ${warning}`))
}

function parse (locale, raw) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    errors.push(`${locale}: invalid JSON (${error.message})`)
    return undefined
  }
}

const locales = listLocales(localesDir)
if (!locales.includes(SOURCE_LOCALE)) {
  console.error(`✖ locales/${SOURCE_LOCALE}.json is missing`)
  process.exit(1)
}

const sourceRaw = readFileSync(join(localesDir, `${SOURCE_LOCALE}.json`), 'utf8')
const source = parse(SOURCE_LOCALE, sourceRaw)
if (!source) {
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
const sourceLeaves = leaves(source)

for (const [key, { value }] of sourceLeaves) {
  const valid = typeof value === 'string' || (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
  if (!valid) errors.push(`${SOURCE_LOCALE}: key "${key}" must be a string or a list of strings`)
}
if (sourceRaw !== serialize(source)) {
  errors.push(`${SOURCE_LOCALE}: not canonically formatted (2-space indent, LF, trailing newline)`)
}

if (args.base && !args['allow-en-us-change']) {
  let baseSource
  try {
    baseSource = JSON.parse(git(root, 'show', `${args.base}:locales/${SOURCE_LOCALE}.json`))
  } catch {
    errors.push(`${SOURCE_LOCALE}: could not read the version at ${args.base}`)
  }
  if (baseSource) {
    const baseLeaves = leaves(baseSource)
    for (const [key, { value }] of sourceLeaves) {
      const baseValue = baseLeaves.get(key)?.value
      if (baseValue === undefined) errors.push(`${SOURCE_LOCALE}: key "${key}" was added. Keys only come from the app, you can only correct existing texts`)
      else report(SOURCE_LOCALE, checkValue(key, baseValue, value, 'the previous version'))
    }
    for (const key of baseLeaves.keys()) {
      if (!sourceLeaves.has(key)) errors.push(`${SOURCE_LOCALE}: key "${key}" was removed. Keys only change in the app, you can only correct existing texts`)
    }
    if (sourceRaw !== serialize(shape(baseSource, source, (value) => value))) {
      errors.push(`${SOURCE_LOCALE}: key order changed`)
    }
  }
}

const table = []

for (const locale of locales.filter((code) => code !== SOURCE_LOCALE)) {
  const raw = readFileSync(join(localesDir, `${locale}.json`), 'utf8')
  const tree = parse(locale, raw)
  if (tree === undefined) continue
  if (!isGroup(tree)) {
    errors.push(`${locale}: must be a JSON object`)
    continue
  }

  const errorCount = errors.length
  for (const [key, { value }] of leaves(tree)) {
    const sourceValue = sourceLeaves.get(key)?.value
    if (sourceValue === undefined) errors.push(`${locale}: key "${key}" does not exist in ${SOURCE_LOCALE}`)
    else if (value !== null) report(locale, checkValue(key, sourceValue, value))
  }
  for (const [key, { path }] of sourceLeaves) {
    if (!args.fix && getLeaf(tree, path) === undefined) errors.push(`${locale}: key "${key}" is missing (fixable with --fix)`)
  }

  const shaped = shape(source, tree, null)
  if (raw !== serialize(shaped)) {
    if (args.fix) {
      writeLocale(localesDir, locale, shaped)
      console.log(`fixed ${locale}`)
    } else if (errors.length === errorCount) {
      errors.push(`${locale}: formatting or key order differs from ${SOURCE_LOCALE} (fixable with --fix)`)
    }
  }

  table.push({ locale, ...completeness(sourceLeaves, tree) })
}

console.log(`\nCompleteness (against ${SOURCE_LOCALE})\n`)
for (const { locale, translated, total } of table) {
  const value = percent(translated, total)
  const bar = '█'.repeat(Math.round(value / 5)).padEnd(20, '░')
  console.log(`  ${locale}  ${bar}  ${String(value).padStart(5)}%  (${translated}/${total})`)
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
