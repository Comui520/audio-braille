import { describe, it, expect } from 'vitest'
import { buildRecognitionBank, sampleRecognitionTrials } from '../src/experiment-bank.js'

describe('辨识刺激库', () => {
  it('四类刺激都有稳定 ID，拼音库远大于当前样例', () => {
    const banks = buildRecognitionBank()
    expect(banks.letters).toHaveLength(26)
    expect(banks.digits).toHaveLength(10)
    expect(banks.syllables.length).toBeGreaterThan(1000)
    expect(banks.symbols.length).toBeGreaterThan(10)
    for (const items of Object.values(banks)) {
      expect(new Set(items.map(item => item.stimulusId)).size).toBe(items.length)
    }
  })

  it('相同种子得到相同顺序，不同种子可以得到不同顺序', () => {
    const bank = buildRecognitionBank().syllables
    const a = sampleRecognitionTrials(bank, 24, 'seed-a')
    const b = sampleRecognitionTrials(bank, 24, 'seed-a')
    const c = sampleRecognitionTrials(bank, 24, 'seed-b')
    expect(a.map(item => item.stimulusId)).toEqual(b.map(item => item.stimulusId))
    expect(a.map(item => item.stimulusId)).not.toEqual(c.map(item => item.stimulusId))
  })

  it('题库容量不足时只返回全部唯一刺激，不重复 ID', () => {
    const bank = buildRecognitionBank().symbols
    const trials = sampleRecognitionTrials(bank, bank.length + 10, 'small-bank')
    expect(trials).toHaveLength(bank.length)
    expect(new Set(trials.map(item => item.stimulusId)).size).toBe(bank.length)
  })

  it('抽样平衡不同方数和声调层级', () => {
    const trials = sampleRecognitionTrials(buildRecognitionBank().syllables, 30, 'balanced')
    expect(new Set(trials.map(item => item.cellCount)).size).toBeGreaterThan(1)
    expect(new Set(trials.map(item => item.tone || 'none')).size).toBeGreaterThan(2)
  })
})
