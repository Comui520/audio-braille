// tests/teaching.test.js
import { describe, it, expect } from 'vitest'
import { createReviewer, pickExamQuestion, gradeAnswer } from '../src/teaching.js'

describe('间隔重复错题本（SM-2 简化变体）', () => {
  it('错误 2 次加入错题本，连续正确 3 次移出', () => {
    const r = createReviewer()
    r.record('ma', false)   // 错 1
    expect(r.isInReview('ma')).toBe(false)
    r.record('ma', false)   // 错 2
    expect(r.isInReview('ma')).toBe(true)
    r.record('ma', true)
    r.record('ma', true)
    expect(r.isInReview('ma')).toBe(true)   // 连续正确 2 次，仍在
    r.record('ma', true)
    expect(r.isInReview('ma')).toBe(false)  // 连续正确 3 次，移出
  })
  it('连续正确计数只在中间无错误时累计', () => {
    const r = createReviewer()
    r.record('ni', false)   // 先错 2 次入错题本
    r.record('ni', false)
    expect(r.isInReview('ni')).toBe(true)
    r.record('ni', true)
    r.record('ni', false)   // 中断连续
    r.record('ni', true)
    r.record('ni', true)
    expect(r.isInReview('ni')).toBe(true)   // 连续仅 2 次
  })
})

describe('考试出题与评分', () => {
  it('每 5 题插入 1 道错题', () => {
    const q = pickExamQuestion({ index: 4, reviewQueue: ['ma'] })
    expect(q).toBe('ma')
    const q2 = pickExamQuestion({ index: 3, reviewQueue: ['ma'] })
    expect(q2).not.toBe('ma')
  })
  it('gradeAnswer 比较点位数组（顺序无关）', () => {
    expect(gradeAnswer([1, 2], [1, 2])).toBe(true)
    expect(gradeAnswer([1, 2], [2, 1])).toBe(true)
    expect(gradeAnswer([1, 2], [1, 3])).toBe(false)
  })
})
