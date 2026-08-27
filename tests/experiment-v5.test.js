// tests/experiment-v5.test.js
import { describe, it, expect } from 'vitest'
import { SHOWCASE_DOTS, buildShowcase, pickLetters, pickSymbols, buildTrials, gradeDots } from '../src/experiment.js'

describe('AudioBraille 展示环节（v5）', () => {
  it('SHOWCASE_DOTS：左列1/2/3 + 右列4/5/6', () => {
    expect(SHOWCASE_DOTS).toEqual([[1], [2], [3], [4], [5], [6]])
  })
  it('buildShowcase 生成 6 个点的描述（左右耳/音高）', () => {
    const s = buildShowcase()
    expect(s).toHaveLength(6)
    expect(s[0].dot).toBe(1)
    expect(s[0].desc).toContain('左')
    expect(s[3].dot).toBe(4)
    expect(s[3].desc).toContain('右')
  })
  it('point desc：点1左耳高音，点5右耳中音', () => {
    const s = buildShowcase()
    expect(s[0].desc).toContain('高音')
    expect(s[4].desc).toContain('右')   // 点5=右列
    expect(s[4].desc).toContain('中音') // 5%3=2 → 中音
  })
})

describe('四类辨识题源（v5）', () => {
  it('pickLetters 生成 10 个不重复字母', () => {
    const letters = pickLetters(10)
    expect(letters).toHaveLength(10)
    expect(new Set(letters).size).toBe(10)
  })
  it('pickSymbols 生成 10 个不重复符号（中文）', () => {
    const symbols = pickSymbols(10, 'zh')
    expect(symbols).toHaveLength(10)
    expect(new Set(symbols).size).toBe(10)
  })
  it('buildTrials 生成字母题（含 cells）', () => {
    const t = buildTrials('letters', 5)
    expect(t).toHaveLength(5)
    expect(t[0].cells).toBeDefined()
    expect(t[0].cells).toHaveLength(1)         // 字母 = 单方
    expect(t[0].cells[0].length).toBeGreaterThan(0)
  })
  it('buildTrials 生成音节题（多方）', () => {
    const t = buildTrials('syllables', 5)
    expect(t).toHaveLength(5)
    expect(t[0].cells).toBeDefined()
    expect(t[0].cells.length).toBeGreaterThanOrEqual(2)   // 声母方+韵母方(+声调方)
  })
  it('buildTrials 生成符号题', () => {
    const t = buildTrials('symbols', 5)
    expect(t).toHaveLength(5)
    expect(t[0].cells).toBeDefined()
  })
  it('v7：所有模式的题目都用 cells（不再有 dots）', () => {
    for (const mode of ['letters', 'syllables', 'symbols', 'digits']) {
      const t = buildTrials(mode, 3)
      expect(t[0].dots).toBeUndefined()
      expect(t[0].cells.every(c => Array.isArray(c))).toBe(true)
    }
  })
})

describe('gradeDots 多方式判定（v7：转发 gradeCells）', () => {
  it('字母题：expected 单层 [1,2,4]，given 单层无序比较', () => {
    expect(gradeDots([1, 2, 4], [4, 1, 2])).toBe(true)
    expect(gradeDots([1, 2, 4], [1, 2, 5])).toBe(false)
  })
  it('字母题：expected 嵌套单方 [[1,5]] + given 单层 → true（旧 bug：永远判错）', () => {
    expect(gradeDots([[1, 5]], [1, 5])).toBe(true)
    expect(gradeDots([[1, 2, 4]], [[4, 1, 2]])).toBe(true)
  })
  it('音节题：expected 多层 [[1,3,4],[3,5],[1]]，given 同构多方 → true', () => {
    expect(gradeDots([[1, 3, 4], [3, 5], [1]], [[1, 3, 4], [3, 5], [1]])).toBe(true)
    expect(gradeDots([[1, 3, 4], [3, 5], [1]], [[4, 3, 1], [5, 3], [1]])).toBe(true)   // 方内无序
  })
  it('音节题：expected 3方 but given 2方 → false', () => {
    expect(gradeDots([[1, 3, 4], [3, 5], [1]], [[1, 3, 4], [3, 5]])).toBe(false)
  })
  it('音节题：given 单层（用户没按*直接0提交）→ false', () => {
    expect(gradeDots([[1, 3, 4], [3, 5], [1]], [1, 3, 4, 3, 5, 1])).toBe(false)
  })
  it('数字题：expected [[3,4,5,6],[1]]，given 同构 → true', () => {
    expect(gradeDots([[3, 4, 5, 6], [1]], [[3, 4, 5, 6], [1]])).toBe(true)
  })
  it('符号题：expected [[5],[2,3]]（句号），given 同构 → true', () => {
    expect(gradeDots([[5], [2, 3]], [[5], [2, 3]])).toBe(true)
    expect(gradeDots([[5], [2, 3]], [[5], [3, 2]])).toBe(true)
  })
  it('符号题：given 各方点集不同 → false', () => {
    expect(gradeDots([[5], [2, 3]], [[5], [3]])).toBe(false)
  })
})