// src/braille-engine.js
// 权威数据源：docs/superpowers/specs/2026-08-27-audiobraille-design.md 第 2 节（GB/T 15720-2008）

// 声母表（g/j、k/h、h/x 共用一方，靠变读规则区分）
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

// 点位 → Unicode（U+2800 + 位掩码：点1=0x01 … 点6=0x20）
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

// 单方解析：先声母，再韵母，再声调（按点位精确匹配，避免前缀歧义）
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
