// tests/input.test.js
import { describe, it, expect } from 'vitest'
import { KEY_DOT_MAP, keyToDot, nextStageAfterConfirm } from '../src/input.js'

describe('键位映射（官方布局，可自定义）', () => {
  it('7→点1 … 2→点6', () => {
    expect(KEY_DOT_MAP['7']).toBe(0)
    expect(KEY_DOT_MAP['4']).toBe(1)
    expect(KEY_DOT_MAP['1']).toBe(2)
    expect(KEY_DOT_MAP['8']).toBe(3)
    expect(KEY_DOT_MAP['5']).toBe(4)
    expect(KEY_DOT_MAP['2']).toBe(5)
  })
  it('keyToDot 未知键返回 null', () => {
    expect(keyToDot('a')).toBe(null)
    expect(keyToDot('0')).toBe(null)   // 0 是确认键，不是点位键
  })
})

describe('输入阶段状态机', () => {
  it('无调：initial→final→commit；带调：initial→final→tone→commit', () => {
    expect(nextStageAfterConfirm('initial', false)).toBe('final')
    expect(nextStageAfterConfirm('final', false)).toBe('commit')
    expect(nextStageAfterConfirm('initial', true)).toBe('final')
    expect(nextStageAfterConfirm('final', true)).toBe('tone')
    expect(nextStageAfterConfirm('tone', true)).toBe('commit')
  })
})
