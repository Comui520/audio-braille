// src/cells.js —— 统一「多方（cells）」模型
// ============================================================
// 根因修复（v7）：项目里点位数据长期存在两种形态混用：
//   单层 [1,3,4]（单方，如拉丁字母/声母/韵母）
//   多层 [[1,3,4],[3,5],[1]]（多方，如拼音音节/数字/中文标点）
// 各模块各自"猜"形态，导致：
//   - teaching.keyHintForDots 对单层抛 "cell.map is not a function" → 拼音/英文教学完全不可用
//   - teaching.gradeAnswerMulti 展平比较 → 方序颠倒/展平输入被误判为正确
//   - experiment.gradeDots 对"expected 嵌套单方 + given 单层"判错 → 字母题永远错
//   - audio-braille.buildChordNotes 收到多层时 FREQ[[1,3,4]] = undefined → 多方音频静音
// 本模块提供唯一权威的 cells 表示与操作，所有模块统一走这里。
// ============================================================

import { dotsToUnicode } from './braille-engine.js'

// 官方键位：7=点1, 4=点2, 1=点3, 8=点4, 5=点5, 2=点6
export const KEY_FOR_DOT = { 1: '7', 2: '4', 3: '1', 4: '8', 5: '5', 6: '2' }

// 归一化：任何形态 → cells（多方数组，每方为点位数字数组）
export function toCells(dots) {
  if (!Array.isArray(dots) || dots.length === 0) return []
  if (Array.isArray(dots[0])) return dots.filter(Array.isArray).map(c => [...c])
  return [[...dots]]
}

// 权威判定：方数相等 + 每方点集相等（方内无序，方序固定）
export function gradeCells(expected, given) {
  const e = toCells(expected)
  const g = toCells(given)
  if (e.length === 0 || g.length === 0) return false
  if (e.length !== g.length) return false
  const key = (c) => [...c].sort((a, b) => a - b).join(',')
  return e.every((cell, i) => key(cell) === key(g[i]))
}

// 分方键位提示：方内键位用空格分隔；方间用 * 对应确认下一方
export function keyHintForCells(dots) {
  return toCells(dots)
    .map(cell => cell.map(d => KEY_FOR_DOT[d]).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('*')
}

// 盲文明文（Unicode 方）
export function cellsToUnicode(dots) {
  return toCells(dots).map(dotsToUnicode).join('')
}

// 数字串 → 逐位朗读（"1852" → "1 8 5 2"）
export function speakableDigits(text) {
  return String(text).replace(/\d{2,}/g, m => [...m].join(' '))
}

const ORDINAL = ['第一方', '第二方', '第三方', '第四方', '第五方', '第六方']

// 点位文字描述（可朗读）
export function cellsDotText(dots) {
  const cells = toCells(dots)
  if (cells.length === 0) return ''
  if (cells.length === 1) return cells[0].map(d => `点${d}`).join('、')
  return cells
    .map((c, i) => `${ORDINAL[i] || `第${i + 1}方`}：${c.map(d => `点${d}`).join('、')}`)
    .join('；')
}

const COUNT_ZH = { 1: '一方', 2: '两方', 3: '三方', 4: '四方', 5: '五方', 6: '六方' }

// 方数说明（提示用户需要输入几方）
export function cellCountLabel(n) {
  return COUNT_ZH[n] || `${n}方`
}

// 盲文方点阵图（v7：教学展示“这个字的盲文长啥样”）
// 返回每方：{ dots: [点1..点6 是否填充], unicode }
export function cellsToDiagram(cells) {
  return toCells(cells).map(cell => ({
    dots: [1, 2, 3, 4, 5, 6].map(d => cell.includes(d)),
    unicode: dotsToUnicode(cell)
  }))
}
