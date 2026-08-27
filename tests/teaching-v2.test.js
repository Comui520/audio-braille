// tests/teaching-v2.test.js —— v5 兼容：保留错题本/评分核心测试
import { describe, it, expect } from 'vitest'
import { createReviewer, pickExamQuestion, gradeAnswer, isLearnPhase } from '../src/teaching.js'

describe('间隔重复错题本（保留）', () => {
  it('错误 2 次加入错题本，连续正确 3 次移出', () => {
    const r = createReviewer()
    r.record('a', false)
    expect(r.isInReview('a')).toBe(false)
    r.record('a', false)
    expect(r.isInReview('a')).toBe(true)
    r.record('a', true)
    r.record('a', true)
    expect(r.isInReview('a')).toBe(true)
    r.record('a', true)
    expect(r.isInReview('a')).toBe(false)
  })
  it('pickExamQuestion 每 5 题插 1 错题', () => {
    expect(pickExamQuestion({ index: 4, reviewQueue: ['m'] })).toBe('m')
    expect(pickExamQuestion({ index: 3, reviewQueue: ['m'] })).toBe(null)
  })
})

describe('gradeAnswer 点位比较（顺序无关）', () => {
  it('相同点位 true，不同 false', () => {
    expect(gradeAnswer([1, 2], [2, 1])).toBe(true)
    expect(gradeAnswer([1, 2], [1, 3])).toBe(false)
  })
})

describe('isLearnPhase', () => {
  it('判断学习阶段', () => {
    expect(isLearnPhase('learn')).toBe(true)
    expect(isLearnPhase('practice')).toBe(false)
    expect(isLearnPhase('exam')).toBe(false)
  })
})
