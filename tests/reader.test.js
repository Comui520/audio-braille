// tests/reader.test.js
import { describe, it, expect } from 'vitest'
import { buildReadingDots, clampSpeed, SAMPLE_TEXT, syllableToDotsSeq } from '../src/reader.js'

describe('听书（v5）', () => {
  it('SAMPLE_TEXT 内置示例短文', () => {
    expect(SAMPLE_TEXT.length).toBeGreaterThan(20)
  })
  it('clampSpeed 限制在 0.5~5x', () => {
    expect(clampSpeed(6)).toBe(5)
    expect(clampSpeed(0.2)).toBe(0.5)
    expect(clampSpeed(2)).toBe(2)
  })
  it('syllableToDotsSeq：ma → [声母m][韵母a]', () => {
    const seq = syllableToDotsSeq('ma')
    expect(seq[0]).toEqual([1, 3, 4])   // m
    expect(seq[1]).toEqual([3, 5])      // a
  })
  it('syllableToDotsSeq：ma1 → 三段（含声调）', () => {
    const seq = syllableToDotsSeq('ma1')
    expect(seq).toHaveLength(3)
    expect(seq[2]).toEqual([1])   // 阴平
  })
  it('syllableToDotsSeq：未知音节返回空数组', () => {
    expect(syllableToDotsSeq('zzz')).toEqual([])
  })
  it('buildReadingDots：整句转成点位序列', () => {
    const seq = buildReadingDots(SAMPLE_TEXT)
    expect(seq.length).toBeGreaterThan(5)
  })
})