// tests/teaching-v5.test.js
import { describe, it, expect } from 'vitest'
import { LESSON_TYPES, TONE_NAMES, pickLessonItem } from '../src/teaching.js'

describe('教学四子模块（v5）', () => {
  it('LESSON_TYPES 含四种', () => {
    expect(LESSON_TYPES).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })
  it('TONE_NAMES：1=阴平 2=阳平 3=上声 4=去声', () => {
    expect(TONE_NAMES['1']).toBe('阴平')
    expect(TONE_NAMES['2']).toBe('阳平')
    expect(TONE_NAMES['3']).toBe('上声')
    expect(TONE_NAMES['4']).toBe('去声')
  })
  it('pickLessonItem：pinyin 出声母/韵母/带调音节题', () => {
    const item = pickLessonItem('pinyin', 0)
    expect(['initial', 'final', 'syllable']).toContain(item.type)
    expect(item.dots).toBeDefined()
  })
  it('pickLessonItem：latin 出字母题，index 0 = a', () => {
    const item = pickLessonItem('latin', 0)
    expect(item.type).toBe('letter')
    expect(item.label).toBe('a')
    expect(item.dots).toEqual([1])
  })
  it('pickLessonItem：symbols 出符号题', () => {
    const item = pickLessonItem('symbols', 0)
    expect(item.type).toBe('symbol')
    expect(item.dots).toBeDefined()
  })
  it('pickLessonItem：digits 出数字题（数字符3456 + 字母方）', () => {
    const item = pickLessonItem('digits', 0)
    expect(item.type).toBe('digit')
    expect(item.dots[0]).toEqual([3, 4, 5, 6])
    expect(item.label).toBe('1')
  })
  it('pickLessonItem：带调音节含 initial/final/tone', () => {
    // 用大 index 触发音节分支
    const item = pickLessonItem('pinyin', 100)
    if (item.type === 'syllable') {
      expect(item.initial).toBeDefined()
      expect(item.final).toBeDefined()
      expect(item.tone).toBeDefined()
    }
  })
})