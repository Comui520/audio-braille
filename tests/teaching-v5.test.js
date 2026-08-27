// tests/teaching-v5.test.js —— v6：四子模块 × 小节
import { describe, it, expect } from 'vitest'
import { LESSON_TYPES, TONE_NAMES, buildSections, keyHintForDots, gradeAnswerMulti, DIGITS } from '../src/teaching.js'

describe('教学四子模块（v6）', () => {
  it('LESSON_TYPES 含四种', () => {
    expect(LESSON_TYPES).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })
  it('TONE_NAMES：1=阴平 2=阳平 3=上声 4=去声', () => {
    expect(TONE_NAMES['1']).toBe('阴平')
    expect(TONE_NAMES['2']).toBe('阳平')
    expect(TONE_NAMES['3']).toBe('上声')
    expect(TONE_NAMES['4']).toBe('去声')
  })
})

describe('小节（section）划分（v6 新增）', () => {
  it('latin 分 3 小节（a-h/i-p/q-z）', () => {
    const secs = buildSections('latin')
    expect(secs).toHaveLength(3)
    expect(secs[0].items[0].label).toBe('a')
    expect(secs[0].items).toHaveLength(8)
    expect(secs[2].items).toHaveLength(10)   // q-z = 10
  })
  it('pinyin 分 3 小节（声母/韵母/带调音节）', () => {
    const secs = buildSections('pinyin')
    expect(secs).toHaveLength(3)
    expect(secs[0].items[0].type).toBe('initial')
    expect(secs[1].items[0].type).toBe('final')
    expect(secs[2].items[0].type).toBe('syllable')
  })
  it('symbols 分 2 小节（中文/英文）', () => {
    const secs = buildSections('symbols')
    expect(secs).toHaveLength(2)
    expect(secs[0].items.length).toBeGreaterThanOrEqual(10)
  })
  it('digits 分 1 小节（0-9），数字符3456 + 字母方', () => {
    const secs = buildSections('digits')
    expect(secs).toHaveLength(1)
    expect(secs[0].items).toHaveLength(10)
    expect(secs[0].items[0].dots[0]).toEqual([3, 4, 5, 6])
    expect(secs[0].items[0].label).toBe('1')
  })
  it('DIGITS 顺序 1-0', () => {
    expect(DIGITS[0]).toBe('1')
    expect(DIGITS[9]).toBe('0')
  })
})

describe('键位提示（v6 分方显示）', () => {
  it('单方 [1] → 7', () => {
    expect(keyHintForDots([[1]])).toBe('7')
  })
  it('字母 f [1,2,4] → 748', () => {
    expect(keyHintForDots([[1, 2, 4]])).toBe('748')
  })
  it('数字 1 [[3456],[1]] → 1852；7（方内连写，方间分号）', () => {
    expect(keyHintForDots([[3, 4, 5, 6], [1]])).toBe('1852；7')
  })
})

describe('gradeAnswerMulti 逐方比较（v6）', () => {
  it('数字 1：用户输 3456+1 两方 → 正确', () => {
    expect(gradeAnswerMulti([[3, 4, 5, 6], [1]], [3, 4, 5, 6, 1])).toBe(true)
  })
  it('数字 1：用户少输 → 错误', () => {
    expect(gradeAnswerMulti([[3, 4, 5, 6], [1]], [3, 4, 5, 6])).toBe(false)
  })
  it('字母 f：单方 [1,2,4] → 正确', () => {
    expect(gradeAnswerMulti([[1, 2, 4]], [1, 2, 4])).toBe(true)
  })
})
