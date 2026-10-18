import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SOURCE_LOCALE = 'en-US'

export const LANGUAGE_NAMES = {
  'en-US': 'English',
  'de-DE': 'German — Deutsch',
  'ru-RU': 'Russian — Русский',
  'fr-FR': 'French — Français',
  'zh-CN': 'Chinese (Simplified) — 中文',
  'it-IT': 'Italian — Italiano',
  'es-ES': 'Spanish — Español',
  'pl-PL': 'Polish — Polski',
  'ar-SA': 'Arabic — العربية'
}

const PLACEHOLDER = /\{\s*[a-zA-Z0-9_$]+\s*\}/g
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g

export function isGroup (value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function listLocales (dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort()
}

export function readLocale (dir, locale) {
  const file = join(dir, `${locale}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
}

export function serialize (tree) {
  return JSON.stringify(tree, null, 2) + '\n'
}

export function writeLocale (dir, locale, tree) {
  writeFileSync(join(dir, `${locale}.json`), serialize(tree))
}

export function readLocales (dir) {
  return Object.fromEntries(listLocales(dir).map((locale) => [locale, readLocale(dir, locale)]))
}

export function git (repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

export function readLocalesAt (repo, ref, dir) {
  let files
  try {
    files = git(repo, 'ls-tree', '--name-only', ref, '--', `${dir}/`).split('\n').filter((file) => file.endsWith('.json'))
  } catch {
    return undefined
  }
  if (!files.length) return undefined
  return Object.fromEntries(files.map((file) => [
    file.slice(dir.length + 1, -'.json'.length),
    JSON.parse(git(repo, 'show', `${ref}:${file}`))
  ]))
}

export function leaves (tree, prefix = [], out = new Map()) {
  if (!isGroup(tree)) return out
  for (const [key, value] of Object.entries(tree)) {
    const path = [...prefix, key]
    if (isGroup(value)) leaves(value, path, out)
    else out.set(path.join('.'), { path, value })
  }
  return out
}

export function getLeaf (tree, path) {
  let node = tree
  for (const key of path) {
    if (!isGroup(node) || !Object.hasOwn(node, key)) return undefined
    node = node[key]
  }
  return isGroup(node) ? undefined : node
}

export function setLeaf (tree, path, value) {
  let node = tree
  for (const key of path.slice(0, -1)) {
    if (!isGroup(node[key])) node[key] = {}
    node = node[key]
  }
  if (value === undefined) delete node[path.at(-1)]
  else node[path.at(-1)] = value
}

export function shape (source, values, fill) {
  const fillFor = typeof fill === 'function' ? fill : () => fill
  const out = {}
  for (const [key, sourceValue] of Object.entries(source)) {
    const value = isGroup(values) ? values[key] : undefined
    if (isGroup(sourceValue)) {
      const child = shape(sourceValue, value, fill)
      if (fill !== undefined || Object.keys(child).length) out[key] = child
    } else {
      const next = value !== undefined && !isGroup(value) ? value : fillFor(sourceValue)
      if (next !== undefined) out[key] = next
    }
  }
  return out
}

function sameValue (a, b) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function changedLeaves (before, after) {
  const beforeLeaves = leaves(before ?? {})
  const afterLeaves = leaves(after ?? {})
  const changed = []
  for (const key of new Set([...beforeLeaves.keys(), ...afterLeaves.keys()])) {
    const previous = beforeLeaves.get(key)
    const next = afterLeaves.get(key)
    if (!sameValue(previous?.value, next?.value)) {
      changed.push({ path: (next ?? previous).path, value: next?.value })
    }
  }
  return changed
}

function tokens (value, pattern) {
  if (typeof value !== 'string') return []
  return (value.match(pattern) ?? []).map((token) => token.replace(/\s+/g, ''))
}

function diffTokens (source, translated, pattern) {
  const counts = new Map()
  for (const token of tokens(source, pattern)) counts.set(token, (counts.get(token) ?? 0) + 1)
  for (const token of tokens(translated, pattern)) counts.set(token, (counts.get(token) ?? 0) - 1)
  const missing = []
  const unexpected = []
  for (const [token, delta] of counts) {
    if (delta > 0) missing.push(...Array(delta).fill(token))
    if (delta < 0) unexpected.push(...Array(-delta).fill(token))
  }
  return { missing, unexpected }
}

function checkMessage (source, translated, reference) {
  const problems = []
  const placeholders = diffTokens(source, translated, PLACEHOLDER)
  if (placeholders.missing.length) problems.push(`is missing placeholder(s) ${placeholders.missing.join(', ')}`)
  if (placeholders.unexpected.length) problems.push(`has unknown placeholder(s) ${placeholders.unexpected.join(', ')}`)
  const html = diffTokens(source, translated, HTML_TAG)
  if (html.unexpected.length) problems.push(`introduces HTML not present in ${reference}: ${html.unexpected.join(', ')}`)
  return problems
}

function pluralForms (value) {
  return value.split('|').length
}

export function checkValue (key, sourceValue, value, reference = SOURCE_LOCALE) {
  const errors = []
  const warnings = []
  const isList = Array.isArray(sourceValue)
  if (isList ? !Array.isArray(value) || value.some((entry) => typeof entry !== 'string') : typeof value !== 'string') {
    errors.push(`key "${key}" must be ${isList ? 'a list of strings' : 'a string'}`)
    return { errors, warnings }
  }
  if (isList && value.length !== sourceValue.length) {
    errors.push(`key "${key}" has ${value.length} entries, ${reference} has ${sourceValue.length}`)
    return { errors, warnings }
  }
  const pairs = isList ? value.map((entry, index) => [`${key}[${index}]`, sourceValue[index], entry]) : [[key, sourceValue, value]]
  for (const [label, expected, actual] of pairs) {
    for (const problem of checkMessage(expected, actual, reference)) errors.push(`key "${label}" ${problem}`)
    if (pluralForms(expected) > 1 && pluralForms(actual) !== pluralForms(expected)) {
      warnings.push(`key "${label}" has ${pluralForms(actual)} plural form(s), ${reference} has ${pluralForms(expected)}`)
    }
  }
  return { errors, warnings }
}

export function completeness (sourceLeaves, tree) {
  let translated = 0
  for (const { path } of sourceLeaves.values()) if (getLeaf(tree, path) != null) translated++
  return { translated, total: sourceLeaves.size }
}

export function percent (translated, total) {
  return total ? Math.floor((translated / total) * 1000) / 10 : 100
}
