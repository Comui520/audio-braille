// tests/symbols.test.js
import { describe, it, expect } from 'vitest'
import { SYMBOLS_CN, SYMBOLS_EN, symbolToDots, CN_SYMBOL_NAMES, EN_SYMBOL_NAMES } from '../src/data/symbols.js'

describe('中文标点（GB/T 15720-2008）', () => {
  it('句号=点5+点23，逗号=点5', () => {
    expect(symbolToDots('cn', '。')).toEqual([[5], [2, 3]])
    expect(symbolToDots('cn', '，')).toEqual([[5]])
  })
  it('问号=点5+点3，叹号=点56+点2', () => {
    expect(symbolToDots('cn', '？')).toEqual([[5], [3]])
    expect(symbolToDots('cn', '！')).toEqual([[5, 6], [2]])
  })
  it('分号=点56，冒号=点36，顿号=点4', () => {
    expect(symbolToDots('cn', '；')).toEqual([[5, 6]])
    expect(symbolToDots('cn', '：')).toEqual([[3, 6]])
    expect(symbolToDots('cn', '、')).toEqual([[4]])
  })
  it('省略号=点5×3', () => {
    expect(symbolToDots('cn', '…')).toEqual([[5], [5], [5]])
  })
  it('中文标点表覆盖常用 10+ 个', () => {
    expect(Object.keys(SYMBOLS_CN).length).toBeGreaterThanOrEqual(10)
  })
  it('中文标点名称表有对应名称', () => {
    expect(CN_SYMBOL_NAMES['。']).toBe('句号')
    expect(CN_SYMBOL_NAMES['，']).toBe('逗号')
  })
})

describe('英文标点（UEB）', () => {
  it('逗号=点2，句号=点256', () => {
    expect(symbolToDots('en', ',')).toEqual([[2]])
    expect(symbolToDots('en', '.')).toEqual([[2, 5, 6]])
  })
  it('问号=点236，叹号=点23456', () => {
    expect(symbolToDots('en', '?')).toEqual([[2, 3, 6]])
    expect(symbolToDots('en', '!')).toEqual([[2, 3, 4, 5, 6]])
  })
  it('分号=点23，冒号=点25', () => {
    expect(symbolToDots('en', ';')).toEqual([[2, 3]])
    expect(symbolToDots('en', ':')).toEqual([[2, 5]])
  })
  it('英文标点表覆盖常用 10 个', () => {
    expect(Object.keys(SYMBOLS_EN).length).toBeGreaterThanOrEqual(10)
  })
  it('英文标点名称表有对应名称', () => {
    expect(EN_SYMBOL_NAMES[',']).toBe('comma')
    expect(EN_SYMBOL_NAMES['.']).toBe('period')
  })
})

describe('symbolToDots 容错', () => {
  it('未知符号返回 null', () => {
    expect(symbolToDots('cn', '~')).toBeNull()
    expect(symbolToDots('en', '~')).toBeNull()
  })
  it('默认语言为中文', () => {
    expect(symbolToDots('xx', '。')).toEqual([[5], [2, 3]])
  })
})
