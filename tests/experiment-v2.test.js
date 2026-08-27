// tests/experiment-v2.test.js
import { describe, it, expect } from 'vitest'
import { createExperiment, summarize, formatResult, pickTrialLetters } from '../src/experiment.js'

describe('实验统计（保留）', () => {
  it('汇总 A/B 组耗时与正确率', () => {
    const exp = createExperiment()
    exp.addTrial('tts', 1.2, true)
    exp.addTrial('tts', 0.8, true)
    exp.addTrial('ab', 3.5, false)
    exp.addTrial('ab', 2.1, true)
    const s = summarize(exp)
    expect(s.tts.avgTime).toBeCloseTo(1.0)
    expect(s.tts.accuracy).toBe(1)
    expect(s.ab.accuracy).toBe(0.5)
  })
  it('formatResult 生成对比播报文案', () => {
    const e = createExperiment()
    e.addTrial('tts', 1.0, true); e.addTrial('tts', 1.0, true)
    e.addTrial('ab', 2.0, false); e.addTrial('ab', 2.0, true)
    expect(formatResult(e)).toContain('语音组')
  })
})

describe('题目生成', () => {
  it('pickTrialLetters 生成 10 个不重复字母', () => {
    const letters = pickTrialLetters(10)
    expect(letters).toHaveLength(10)
    expect(new Set(letters).size).toBe(10)
    expect(letters.every(l => /^[a-z]$/.test(l))).toBe(true)
  })
  it('顺序随机化（两次调用大概率不同）', () => {
    const a = pickTrialLetters(26).join('')
    const b = pickTrialLetters(26).join('')
    // 26 个字母全排列，两次完全相同的概率极小
    expect(a).not.toBe(b)
  })
})
