// tests/experiment-v5.test.js
import { describe, it, expect } from 'vitest'
import { SHOWCASE_DOTS, buildShowcase, pickLetters, pickSymbols, buildTrials } from '../src/experiment.js'

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
  it('buildTrials 生成字母题（含点位）', () => {
    const t = buildTrials('letters', 5)
    expect(t).toHaveLength(5)
    expect(t[0].dots).toBeDefined()
    expect(t[0].dots.length).toBeGreaterThan(0)
  })
  it('buildTrials 生成音节题（3方）', () => {
    const t = buildTrials('syllables', 5)
    expect(t).toHaveLength(5)
    expect(t[0].dots).toBeDefined()
  })
  it('buildTrials 生成符号题', () => {
    const t = buildTrials('symbols', 5)
    expect(t).toHaveLength(5)
    expect(t[0].dots).toBeDefined()
  })
})