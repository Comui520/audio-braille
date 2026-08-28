// tests/teaching-v5.test.js —— v7：四子模块 × 小节（统一 cells 模型）
import { describe, it, expect } from 'vitest'
import { LESSON_TYPES, TONE_NAMES, buildSections, DIGITS } from '../src/teaching.js'
import { keyHintForCells, gradeCells } from '../src/cells.js'

describe('教学四子模块（v7）', () => {
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

describe('小节（section）划分（v7）', () => {
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
    expect(secs[0].items[0].cells[0]).toEqual([3, 4, 5, 6])
    expect(secs[0].items[0].label).toBe('1')
  })
  it('DIGITS 顺序 1-0', () => {
    expect(DIGITS[0]).toBe('1')
    expect(DIGITS[9]).toBe('0')
  })
  it('v7：所有小节的 items 都带 cells（多方数组），且不再有 dots', () => {
    for (const kind of LESSON_TYPES) {
      for (const sec of buildSections(kind)) {
        for (const item of sec.items) {
          expect(Array.isArray(item.cells)).toBe(true)
          expect(item.cells.length).toBeGreaterThan(0)
          expect(item.cells.every(c => Array.isArray(c))).toBe(true)
          expect(item.dots).toBeUndefined()
        }
      }
    }
  })
})

describe('键位提示（v12：方内空格分隔，方间星号）', () => {
  it('单方 [1] → 7', () => {
    expect(keyHintForCells([[1]])).toBe('7')
  })
  it('字母 f [1,2,4] → 7 4 8', () => {
    expect(keyHintForCells([[1, 2, 4]])).toBe('7 4 8')
  })
  it('数字 1 [[3456],[1]] → 1 8 5 2*7', () => {
    expect(keyHintForCells([[3, 4, 5, 6], [1]])).toBe('1 8 5 2*7')
  })

  it('三方提示使用星号且不使用分号', () => {
    expect(keyHintForCells([[1], [1], [1]])).toBe('7*7*7')
    expect(keyHintForCells([[1], [1], [1]])).not.toContain('；')
  })
  it('单层输入不再抛异常（旧 bug：拼音/英文教学崩溃）', () => {
    expect(() => keyHintForCells([1, 2, 4])).not.toThrow()
    expect(keyHintForCells([1, 2, 4])).toBe('7 4 8')
  })
})

describe('gradeCells 逐方判定（v7 替代 gradeAnswerMulti）', () => {
  it('数字 1：用户逐方输 [[3456],[1]] → 正确', () => {
    expect(gradeCells([[3, 4, 5, 6], [1]], [[3, 4, 5, 6], [1]])).toBe(true)
  })
  it('数字 1：用户展平输 [3,4,5,6,1] 一方 → 错误（不能靠展平蒙对）', () => {
    expect(gradeCells([[3, 4, 5, 6], [1]], [3, 4, 5, 6, 1])).toBe(false)
  })
  it('数字 1：用户少输一方 → 错误', () => {
    expect(gradeCells([[3, 4, 5, 6], [1]], [[3, 4, 5, 6]])).toBe(false)
  })
  it('数字 1：方序颠倒 → 错误', () => {
    expect(gradeCells([[3, 4, 5, 6], [1]], [[1], [3, 4, 5, 6]])).toBe(false)
  })
  it('字母 f：单方 [1,2,4] → 正确', () => {
    expect(gradeCells([[1, 2, 4]], [1, 2, 4])).toBe(true)
  })
  it('字母 f：方内顺序无关', () => {
    expect(gradeCells([[1, 2, 4]], [4, 1, 2])).toBe(true)
  })
})
