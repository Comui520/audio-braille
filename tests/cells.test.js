// tests/cells.test.js —— 统一"多方"模型（v7 架构修正）
import { describe, it, expect } from 'vitest'
import {
  toCells, gradeCells, keyHintForCells, cellsToUnicode,
  speakableDigits, cellsDotText, cellCountLabel
} from '../src/cells.js'

describe('toCells：归一化为多方模型', () => {
  it('单层点位 → 单方', () => {
    expect(toCells([1, 3, 4])).toEqual([[1, 3, 4]])
  })
  it('多层原样返回（拷贝）', () => {
    expect(toCells([[1], [2, 3]])).toEqual([[1], [2, 3]])
  })
  it('空数组 → 空', () => {
    expect(toCells([])).toEqual([])
  })
  it('null/undefined → 空', () => {
    expect(toCells(null)).toEqual([])
    expect(toCells(undefined)).toEqual([])
  })
})

describe('gradeCells：权威判定（方数相等，方内无序，方序固定）', () => {
  it('单方：方内顺序无关', () => {
    expect(gradeCells([[1, 3, 4]], [[4, 1, 3]])).toBe(true)
  })
  it('单方 expected 与单层 given 可比', () => {
    expect(gradeCells([1, 3, 4], [1, 3, 4])).toBe(true)
    expect(gradeCells([[1, 5]], [1, 5])).toBe(true)
  })
  it('多方：全对', () => {
    expect(gradeCells([[3, 4, 5, 6], [1, 2]], [[3, 4, 5, 6], [2, 1]])).toBe(true)
  })
  it('多方：方序颠倒 → 错', () => {
    expect(gradeCells([[3, 4, 5, 6], [1, 2]], [[1, 2], [3, 4, 5, 6]])).toBe(false)
  })
  it('多方：用户展平成一方 → 错（不能靠展平蒙对）', () => {
    expect(gradeCells([[3, 4, 5, 6], [1, 2]], [[1, 2, 3, 4, 5, 6]])).toBe(false)
  })
  it('多方：方数不足 → 错', () => {
    expect(gradeCells([[3, 4, 5, 6], [1, 2]], [[3, 4, 5, 6]])).toBe(false)
  })
  it('多方：方数过多 → 错', () => {
    expect(gradeCells([[1]], [[1], [2]])).toBe(false)
  })
  it('空输入 → 错', () => {
    expect(gradeCells([[1]], [])).toBe(false)
    expect(gradeCells([], [[1]])).toBe(false)
  })
})

describe('keyHintForCells：分方键位提示（单层/多层都不崩）', () => {
  it('单层不抛异常（旧 bug：cell.map is not a function）', () => {
    expect(() => keyHintForCells([1])).not.toThrow()
    expect(keyHintForCells([1])).toBe('7')
  })
  it('单方多点', () => {
    expect(keyHintForCells([[1, 3, 4]])).toBe('7 1 8')
  })
  it('多方用星号分隔', () => {
    expect(keyHintForCells([[3, 4, 5, 6], [1]])).toBe('1 8 5 2*7')
  })
  it('空 → 空串', () => {
    expect(keyHintForCells([])).toBe('')
  })
})

describe('cellsToUnicode：盲文明文', () => {
  it('m 的方 = U+280D', () => {
    expect(cellsToUnicode([[1, 3, 4]])).toBe('\u280d')
  })
  it('多方连写', () => {
    expect(cellsToUnicode([[1, 3, 4], [3, 5]])).toBe('\u280d\u2814')
  })
  it('单层也支持', () => {
    expect(cellsToUnicode([1])).toBe('\u2801')
  })
})

describe('speakableDigits：数字逐位朗读（旧 bug：1852 读成一千八百五十二）', () => {
  it('键位串拆成单个数字', () => {
    expect(speakableDigits('1852')).toBe('1 8 5 2')
  })
  it('保留分隔符', () => {
    expect(speakableDigits('1852；7')).toBe('1 8 5 2；7')
  })
  it('非数字原样', () => {
    expect(speakableDigits('abc')).toBe('abc')
  })
})

describe('cellsDotText：点位文字（可朗读）', () => {
  it('单方', () => {
    expect(cellsDotText([[1, 3, 4]])).toBe('点1、点3、点4')
  })
  it('多方分方描述', () => {
    expect(cellsDotText([[1], [2]])).toBe('第一方：点1；第二方：点2')
  })
})

describe('cellCountLabel：方数说明', () => {
  it('1 方', () => expect(cellCountLabel(1)).toBe('一方'))
  it('2 方', () => expect(cellCountLabel(2)).toBe('两方'))
  it('3 方', () => expect(cellCountLabel(3)).toBe('三方'))
})
