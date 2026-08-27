// tests/experiment.test.js —— v4：分步听觉识别实验
import { describe, it, expect } from 'vitest'
import { pickTrialLetters, createAudioTrial, pickTrialDots, gradeDots, createExperiment, summarize } from '../src/experiment.js'

describe('实验统计', () => {
  it('汇总正确率与平均耗时', () => {
    const exp = createExperiment()
    exp.addTrial([1, 2, 4], [1, 2, 4], 1.2, true)
    exp.addTrial([1, 3, 5], [1, 3, 5], 0.8, true)
    exp.addTrial([2, 4, 6], [2, 4, 5], 3.5, false)
    const s = summarize(exp)
    expect(s.accuracy).toBeCloseTo(2 / 3)
    expect(s.avgTime).toBeCloseTo((1.2 + 0.8 + 3.5) / 3)
    expect(s.count).toBe(3)
  })
  it('空实验返回零值', () => {
    const s = summarize(createExperiment())
    expect(s).toEqual({ count: 0, accuracy: 0, avgTime: 0 })
  })
})

describe('题目生成', () => {
  it('pickTrialLetters 生成 10 个不重复字母', () => {
    const letters = pickTrialLetters(10)
    expect(letters).toHaveLength(10)
    expect(new Set(letters).size).toBe(10)
    expect(letters.every(l => /^[a-z]$/.test(l))).toBe(true)
  })
  it('createAudioTrial 生成 3-6 个不重复点位', () => {
    const t = createAudioTrial()
    expect(t.dots.length).toBeGreaterThanOrEqual(3)
    expect(t.dots.length).toBeLessThanOrEqual(6)
    expect(new Set(t.dots).size).toBe(t.dots.length)
    expect(t.dots.every(d => d >= 1 && d <= 6)).toBe(true)
  })
  it('pickTrialDots 生成 10 个不重复题目', () => {
    const trials = pickTrialDots(10)
    expect(trials).toHaveLength(10)
    expect(new Set(trials.map(d => [...d].sort().join(','))).size).toBe(10)
  })
})

describe('评分', () => {
  it('gradeDots 顺序无关', () => {
    expect(gradeDots([1, 2, 4], [4, 1, 2])).toBe(true)
    expect(gradeDots([1, 2], [1, 3])).toBe(false)
  })
})
