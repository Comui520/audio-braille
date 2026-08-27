// tests/teaching-v2.test.js
import { describe, it, expect } from 'vitest'
import { createReviewer, pickExamQuestion, gradeAnswer, pickItem, isLearnPhase } from '../src/teaching.js'

describe('间隔重复错题本（保留 v1 逻辑）', () => {
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

describe('三阶段教学出题（英文优先）', () => {
  it('学阶段：出单个字母，含名称/音频信息', () => {
    const item = pickItem({ phase: 'learn', alphabet: 'abc', index: 0 })
    expect(item.type).toBe('letter')
    expect(item.label).toBe('a')
    expect(item.dots).toEqual([1])
    expect(item.latin).toBe('a')
  })
  it('练阶段：出字母，提示为名称', () => {
    const item = pickItem({ phase: 'practice', alphabet: 'abc', index: 0 })
    expect(item.type).toBe('letter')
    expect(item.label).toBe('a')
  })
  it('考阶段：出字母，可出带调音节（英文模式不用调）', () => {
    const item = pickItem({ phase: 'exam', alphabet: 'abc', index: 0 })
    expect(item.type).toBe('letter')
    expect(item.label).toBe('a')
  })
  it('isLearnPhase 判断学习阶段', () => {
    expect(isLearnPhase('learn')).toBe(true)
    expect(isLearnPhase('practice')).toBe(false)
    expect(isLearnPhase('exam')).toBe(false)
  })
})
