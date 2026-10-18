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
  const out = {}
  for (const [key, sourceValue] of Object.entries(source)) {
    const value = isGroup(values) ? values[key] : undefined
    if (isGroup(sourceValue)) {
      const child = shape(sourceValue, value, fill)
      if (fill !== undefined || Object.keys(child).length) out[key] = child
    } else if (value !== undefined && !isGroup(value)) {
      out[key] = value
    } else if (fill !== undefined) {
      out[key] = fill
    }
  }
  return out
}

export function sameValue (a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
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

export function checkMessage (source, translated) {
  const problems = []
  const placeholders = diffTokens(source, translated, PLACEHOLDER)
  if (placeholders.missing.length) problems.push(`is missing placeholder(s) ${placeholders.missing.join(', ')}`)
  if (placeholders.unexpected.length) problems.push(`has unknown placeholder(s) ${placeholders.unexpected.join(', ')}`)
  const html = diffTokens(source, translated, HTML_TAG)
  if (html.unexpected.length) problems.push(`introduces HTML not present in ${SOURCE_LOCALE}: ${html.unexpected.join(', ')}`)
  return problems
}

export function pluralForms (value) {
  return typeof value === 'string' ? value.split('|').length : 1
}

export function completeness (source, tree) {
  const total = leaves(source).size
  let translated = 0
  for (const { value } of leaves(tree).values()) if (value !== null) translated++
  return { translated, total }
}
