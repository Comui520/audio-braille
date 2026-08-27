// tests/experiment.test.js
import { describe, it, expect } from 'vitest'
import { createExperiment, summarize, formatResult } from '../src/experiment.js'

describe('实验统计', () => {
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
  it('交叉组序：先 A 后 B（学习效应控制说明）', () => {
    const exp = createExperiment({ order: 'AB' })
    expect(exp.order).toBe('AB')
  })
  it('formatResult 生成对比播报文案', () => {
    const s = summarize((() => {
      const e = createExperiment()
      e.addTrial('tts', 1.0, true)
      e.addTrial('tts', 1.0, true)
      e.addTrial('ab', 2.0, false)
      e.addTrial('ab', 2.0, true)
      return e
    })())
    expect(formatResult(s)).toContain('语音组')
    expect(formatResult(s)).toContain('1.0 秒')
    expect(formatResult(s)).toContain('2.0 秒')
  })
})
