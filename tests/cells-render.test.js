// tests/cells-render.test.js —— 盲文方视觉图（v7：教学展示"这个字的盲文长啥样"）
import { describe, it, expect } from 'vitest'
import { cellsToDiagram } from '../src/cells.js'

describe('cellsToDiagram：盲文方点阵图（明眼人可看）', () => {
  it('单方 a=点1：只有点1 填充', () => {
    const d = cellsToDiagram([[1]])
    expect(d).toHaveLength(1)
    expect(d[0].dots).toEqual([true, false, false, false, false, false])
    expect(d[0].unicode).toBe('\u2801')
  })
  it('m=点134', () => {
    const d = cellsToDiagram([[1, 3, 4]])
    expect(d[0].dots).toEqual([true, false, true, true, false, false])
    expect(d[0].unicode).toBe('\u280d')
  })
  it('多方：数字 1 = 数字符 + a', () => {
    const d = cellsToDiagram([[3, 4, 5, 6], [1]])
    expect(d).toHaveLength(2)
    expect(d[0].dots).toEqual([false, false, true, true, true, true])
    expect(d[1].dots).toEqual([true, false, false, false, false, false])
  })
  it('单层输入也支持', () => {
    expect(cellsToDiagram([1, 2])).toHaveLength(1)
  })
  it('空 → 空数组', () => {
    expect(cellsToDiagram([])).toEqual([])
  })
})
