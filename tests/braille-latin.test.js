// tests/braille-latin.test.js
import { describe, it, expect } from 'vitest'
import { LATIN_LETTERS, latinToDots, dotsToLatin, latinToUnicode } from '../src/braille-engine.js'

describe('拉丁字母盲文表（国际标准）', () => {
  it('a-z 全部 26 个字母点位正确', () => {
    const expected = {
      a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
      f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
      k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
      p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
      u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
    }
    expect(LATIN_LETTERS).toEqual(expected)
  })
  it('latinToDots / dotsToLatin 往返', () => {
    expect(latinToDots('g')).toEqual([1, 2, 4, 5])
    expect(dotsToLatin([1, 2, 4, 5])).toBe('g')
    expect(dotsToLatin([1, 3, 4])).toBe('m')
    expect(dotsToLatin([5])).toBe(null)
  })
  it('latinToUnicode 生成 Unicode 盲文方', () => {
    expect(latinToUnicode('a')).toBe('\u2801')   // 点1
    expect(latinToUnicode('g')).toBe('\u281b')   // 1245
  })
  it('未知字母返回 null', () => {
    expect(latinToDots('1')).toBe(null)
    expect(latinToDots('A')).toBe(null)   // 仅小写
  })
})
