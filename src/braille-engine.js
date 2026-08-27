// src/braille-engine.js
// 权威数据源：docs/superpowers/specs/2026-08-27-audiobraille-design.md 第 2 节（GB/T 15720-2008）

// 声母表（g/j、k/q、h/x 共用一方，靠变读规则区分）
export const INITIALS = {
  b: [1, 2], p: [1, 2, 3, 4], m: [1, 3, 4], f: [1, 2, 4],
  d: [1, 4, 5], t: [2, 3, 4, 5], n: [1, 3, 4, 5], l: [1, 2, 3],
  g: [1, 2, 4, 5], k: [1, 3], h: [1, 2, 5],
  j: [1, 2, 4, 5], q: [1, 3], x: [1, 2, 5],   // 变读结果，与 g/k/h 同点位
  zh: [3, 4], ch: [1, 2, 3, 4, 5], sh: [1, 5, 6], r: [2, 4, 5],
  z: [1, 3, 5, 6], c: [1, 4], s: [2, 3, 4]
}

// 韵母表（括号内为自成音节写法；e/o 共用 26）
export const FINALS = {
  a: [3, 5], o: [2, 6], e: [2, 6], i: [2, 4], u: [1, 3, 6], ü: [3, 4, 6],
  ai: [2, 4, 6], ei: [2, 3, 4, 6], ui: [2, 4, 5, 6],
  ao: [2, 3, 5], ou: [1, 2, 3, 5, 6], iu: [1, 2, 5, 6],
  ie: [1, 5], üe: [2, 3, 4, 5, 6], er: [1, 2, 3, 5],
  an: [1, 2, 3, 6], en: [3, 5, 6], in: [1, 2, 6], un: [2, 5], ün: [4, 5, 6],
  ang: [2, 3, 6], eng: [3, 4, 5, 6], ing: [1, 6], ong: [2, 5, 6],
  ia: [1, 2, 4, 6], ua: [1, 2, 3, 4, 5, 6], uo: [1, 3, 5], uai: [1, 3, 4, 5, 6],
  ian: [1, 4, 6], uan: [1, 2, 4, 5, 6], üan: [1, 2, 3, 4, 6],
  iang: [1, 3, 4, 6], uang: [2, 3, 5, 6], iong: [1, 4, 5, 6],
  iao: [3, 4, 5]
}

// 声调：阴平=1、阳平=2、上声=3、去声=23、轻声不标
export const TONES = { '1': [1], '2': [2], '3': [3], '4': [2, 3] }

const KEY = (arr) => [...arr].sort((a, b) => a - b).join(',')

// ===== 盲文数字（国际标准：数字符号 + a-j） =====
// 数字符号 = 点3456（U+283C）；其后 a-j 对应 1-0（a=1, b=2, ..., i=9, j=0）
export const DIGIT_SIGN = [3, 4, 5, 6]
export const DIGIT_LETTERS = { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6', g: '7', h: '8', i: '9', j: '0' }
const LETTER_DIGITS = Object.fromEntries(Object.entries(DIGIT_LETTERS).map(([k, v]) => [k, v]))

// 单个数字 → Unicode（数字符号 + 对应字母方）
export function digitToUnicode(digit) {
  const letter = Object.keys(DIGIT_LETTERS).find(k => DIGIT_LETTERS[k] === String(digit))
  if (!letter) return null
  return dotsToUnicode(DIGIT_SIGN) + dotsToUnicode(LATIN_LETTERS[letter])
}

// 数字串 → Unicode（每个数字都带数字符号，符合国际盲文规则）
export function digitsToUnicode(numStr) {
  return [...numStr].map(d => digitToUnicode(d)).join('')
}

// Unicode 盲文文本 → 数字串（识别 数字符号+字母 对；无数字符号返回 null）
export function unicodeToDigits(text) {
  const chars = [...text]
  const digitSignMask = maskOf(DIGIT_SIGN)
  let out = ''
  let i = 0
  while (i < chars.length) {
    const mask = chars[i].codePointAt(0) - 0x2800
    if (mask !== digitSignMask) return null   // 遇到非数字符号立即失败
    i++
    if (i >= chars.length) return null
    const letterMask = chars[i].codePointAt(0) - 0x2800
    const letter = latinReverseMask()[letterMask]
    if (!letter || !LETTER_DIGITS[letter]) return null
    out += LETTER_DIGITS[letter]
    i++
  }
  return out || null
}

// 点阵掩码（辅助）
function maskOf(dots) {
  return [...dots].reduce((acc, d) => acc | (1 << (d - 1)), 0)
}

// 掩码 → 拉丁字母（反查 LATIN_LETTERS，惰性求值：LATIN_LETTERS 在下方定义）
let LATIN_REVERSE_MASK = null
function latinReverseMask() {
  if (!LATIN_REVERSE_MASK) {
    LATIN_REVERSE_MASK = Object.fromEntries(Object.entries(LATIN_LETTERS).map(([k, v]) => [maskOf(v), k]))
  }
  return LATIN_REVERSE_MASK
}

export function dotsToUnicode(dots) {
  const mask = [...dots].reduce((acc, d) => acc | (1 << (d - 1)), 0)
  return String.fromCodePoint(0x2800 + mask)
}

export function unicodeToDots(ch) {
  const mask = ch.codePointAt(0) - 0x2800
  const dots = []
  for (let i = 1; i <= 6; i++) if (mask & (1 << (i - 1))) dots.push(i)
  return dots
}

// 变读：g/k/h 与 i、ü 及 i/ü 开头韵母相拼 → j/q/x
const VARIATION_MAP = { g: 'j', k: 'q', h: 'x' }
const I_U_FINALS = new Set(['i', 'ü', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'üe', 'üan', 'ün'])
export function applyVariation(initial, final) {
  if (VARIATION_MAP[initial] && I_U_FINALS.has(final)) return { initial: VARIATION_MAP[initial], final }
  return { initial, final }
}

// 拉丁字母盲文表（国际标准，Unicode 盲文）；与现行盲文声母同源
// 权威来源：Unicode Braille Patterns / 维基百科英语盲文条目（已写入规格第 2 节对照）
export const LATIN_LETTERS = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
}

const LATIN_REVERSE = Object.fromEntries(Object.entries(LATIN_LETTERS).map(([k, v]) => [v.join(','), k]))

export function latinToDots(letter) {
  return LATIN_LETTERS[letter] ?? null
}

export function dotsToLatin(dots) {
  return LATIN_REVERSE[[...dots].sort((a, b) => a - b).join(',')] ?? null
}

export function latinToUnicode(letter) {
  const dots = LATIN_LETTERS[letter]
  return dots ? dotsToUnicode(dots) : null
}

// 单方解析：先声母，再韵母，再声调（按点位精确匹配，避免前缀歧义）
// 注意：不解析拉丁字母（避免与声母点位混淆）；英文模式用 dotsToLatin
export function dotsToComponent(dotsArray) {
  const key = KEY(dotsArray)
  for (const [value, dots] of Object.entries(INITIALS)) if (KEY(dots) === key) return { type: 'initial', value }
  for (const [value, dots] of Object.entries(FINALS)) if (KEY(dots) === key) return { type: 'final', value }
  for (const [tone, dots] of Object.entries(TONES)) if (KEY(dots) === key) return { type: 'tone', value: tone }
  return null
}

// 音节 → 方序列 [声母方, 韵母方, 声调方?]（先变读再取点位）
export function syllableToDots(initial, final, tone) {
  const { initial: vi } = applyVariation(initial, final)
  const seq = [INITIALS[vi], FINALS[final]].filter(Boolean)
  if (tone && TONES[tone]) seq.push(TONES[tone])
  return seq
}

// ===== 对照字表与转写 =====
import { HANZI_TABLE } from './data/hanzi-table.js'

// 零声母书写形式：i/u/ü 自成音节时写 yi/wu/yu
const ZERO_INITIAL_MAP = { i: 'yi', u: 'wu', ü: 'yu' }

// 按 声母+韵母+声调 查对照字（先变读规范化；ü 归一化为 u；零声母写 yi/wu/yu）
export function getReferences(initial, final, tone) {
  const { initial: vi } = applyVariation(initial, final)
  const hasInitial = vi !== ''
  // 零声母：韵母自成音节时书写形式 yi/wu/yu（如 i→yi），不再拼接声母前缀
  const pinyinKey = hasInitial ? `${vi}${final}` : (ZERO_INITIAL_MAP[final] ?? final)
  const key = `${pinyinKey}:${tone || ''}`.replace(/ü/g, 'u')
  return HANZI_TABLE[key] ?? []
}

// 盲文方序列 → 汉字明文。
// 输入：[[1,3,4],[3,5],[1], ...]（每 2~3 方一个音节）。
// 简策略：按 声母方+韵母方(+声调方) 分组；韵母可自成音节（零声母）。同音取字表第一个字。
export function transliterate(dotsSequence) {
  const out = []
  let i = 0
  while (i < dotsSequence.length) {
    const c1 = dotsToComponent(dotsSequence[i])
    const c2 = dotsToComponent(dotsSequence[i + 1])
    if (c1?.type === 'initial' && c2?.type === 'final') {
      const c3 = dotsToComponent(dotsSequence[i + 2])
      const tone = c3?.type === 'tone' ? c3.value : null
      const refs = getReferences(c1.value, c2.value, tone)
      out.push(refs[0] ?? '')
      i += tone ? 3 : 2
    } else if (c1?.type === 'final') {
      // 零声母：韵母自成音节（如 yi1 → [韵母 i][声调 1]）
      const c2t = dotsToComponent(dotsSequence[i + 1])
      const tone = c2t?.type === 'tone' ? c2t.value : null
      const refs = getReferences('', c1.value, tone)
      out.push(refs[0] ?? '')
      i += tone ? 2 : 1
    } else {
      out.push('')   // 无法解析的一方（如标点/空格），占位
      i += 1
    }
  }
  return out.join('')
}
