// tests/braille-engine.test.js
import { describe, it, expect } from 'vitest'
import {
  INITIALS, FINALS, TONES,
  dotsToUnicode, unicodeToDots,
  applyVariation, syllableToDots, dotsToComponent,
  getReferences, transliterate
} from '../src/braille-engine.js'

describe('编码表（必须与规格第 2 节一致）', () => {
  it('声母表关键点位', () => {
    expect(INITIALS.b).toEqual([1, 2])
    expect(INITIALS.p).toEqual([1, 2, 3, 4])
    expect(INITIALS.zh).toEqual([3, 4])
    expect(INITIALS.sh).toEqual([1, 5, 6])
  })
  it('韵母表关键点位', () => {
    expect(FINALS.a).toEqual([3, 5])
    expect(FINALS.i).toEqual([2, 4])
    expect(FINALS.ü).toEqual([3, 4, 6])
    expect(FINALS.üan).toEqual([1, 2, 3, 4, 6])
    expect(FINALS.er).toEqual([1, 2, 3, 5])
  })
  it('声调：去声为点23（不是点4）', () => {
    expect(TONES['1']).toEqual([1])
    expect(TONES['2']).toEqual([2])
    expect(TONES['3']).toEqual([3])
    expect(TONES['4']).toEqual([2, 3])
  })
})

describe('Unicode 盲文', () => {
  it('空方为 U+2800，点1+2 为 U+2803', () => {
    expect(dotsToUnicode([])).toBe('\u2800')
    expect(dotsToUnicode([1, 2])).toBe('\u2803')
    expect(unicodeToDots('\u2803')).toEqual([1, 2])
  })
})

describe('变读规则 g/k/h → j/q/x', () => {
  it('g+iao → jiao', () => {
    expect(applyVariation('g', 'iao')).toEqual({ initial: 'j', final: 'iao' })
  })
  it('k+u 不变', () => {
    expect(applyVariation('k', 'u')).toEqual({ initial: 'k', final: 'u' })
  })
  it('h+ü → xu', () => {
    expect(applyVariation('h', 'ü')).toEqual({ initial: 'x', final: 'ü' })
  })
})

describe('syllableToDots / dotsToComponent 往返', () => {
  it('ma1 → [声母m][韵母a][声调1]，再解析回', () => {
    const seq = syllableToDots('m', 'a', '1')
    expect(seq).toEqual([[1, 3, 4], [3, 5], [1]])
    expect(dotsToComponent(seq[0])).toEqual({ type: 'initial', value: 'm' })
    expect(dotsToComponent(seq[1])).toEqual({ type: 'final', value: 'a' })
    expect(dotsToComponent(seq[2])).toEqual({ type: 'tone', value: '1' })
  })
  it('无调音节只返回两方', () => {
    const seq = syllableToDots('b', 'a', null)
    expect(seq).toEqual([[1, 2], [3, 5]])
  })
  it('满点 123456 是合法韵母 ua（不是未知点位）', () => {
    expect(dotsToComponent([1, 2, 3, 4, 5, 6])).toEqual({ type: 'final', value: 'ua' })
  })
  it('未知点位返回 null（[5] 不在任何表中）', () => {
    expect(dotsToComponent([5])).toBe(null)
  })
})

describe('对照字表与转写', () => {
  it('getReferences 按声韵调索引返回常用字', () => {
    const refs = getReferences('m', 'a', '1')
    expect(refs).toContain('妈')
  })
  it('轻声用空声调键（吗 = ma 轻声）', () => {
    const refs = getReferences('m', 'a', '')
    expect(refs).toContain('吗')
  })
  it('ü 系韵母归一化为 u 键（h+üe → xue2 学）', () => {
    const refs = getReferences('h', 'üe', '2')
    expect(refs).toContain('学')
  })
  it('未知音节返回空数组', () => {
    expect(getReferences('x', 'x', '1')).toEqual([])
  })
  it('transliterate 把盲文方序列转成汉字（同音取第一个）', () => {
    // 妈(ma1) + 好(hao3)
    const seq = [...syllableToDots('m', 'a', '1'), ...syllableToDots('h', 'ao', '3')]
    expect(transliterate(seq)).toBe('妈好')
  })
  it('transliterate 支持零声母自成音节（一 yi1）', () => {
    const seq = syllableToDots('', 'i', '1')
    expect(seq).toEqual([[2, 4], [1]])
    expect(transliterate(seq)).toBe('一')
  })
})

describe('编码表全量断言（防规格数据回归）', () => {
  it('全部 18 个声母与规格 2.2 一致', () => {
    const expected = {
      b: [1, 2], p: [1, 2, 3, 4], m: [1, 3, 4], f: [1, 2, 4],
      d: [1, 4, 5], t: [2, 3, 4, 5], n: [1, 3, 4, 5], l: [1, 2, 3],
      g: [1, 2, 4, 5], k: [1, 3], h: [1, 2, 5],
      j: [1, 2, 4, 5], q: [1, 3], x: [1, 2, 5],
      zh: [3, 4], ch: [1, 2, 3, 4, 5], sh: [1, 5, 6], r: [2, 4, 5],
      z: [1, 3, 5, 6], c: [1, 4], s: [2, 3, 4]
    }
    expect(INITIALS).toEqual(expected)
  })
  it('全部 34 个韵母与规格 2.3 一致', () => {
    const expected = {
      a: [3, 5], o: [2, 6], e: [2, 6], i: [2, 4], u: [1, 3, 6], ü: [3, 4, 6],
      ai: [2, 4, 6], ei: [2, 3, 4, 6], ui: [2, 4, 5, 6],
      ao: [2, 3, 5], ou: [1, 2, 3, 5, 6], iu: [1, 2, 5, 6],
      ie: [1, 5], üe: [2, 3, 4, 5, 6], er: [1, 2, 3, 5],
      an: [1, 2, 3, 6], en: [3, 5, 6], in: [1, 2, 6], un: [2, 5], ün: [4, 5, 6],
      ang: [2, 3, 6], eng: [3, 4, 5, 6], ing: [1, 6], ong: [2, 5, 6],
      ia: [1, 2, 4, 6], ua: [1, 2, 3, 4, 5, 6], uo: [1, 3, 5], uai: [1, 3, 4, 5, 6],
      ian: [1, 4, 6], uan: [1, 2, 4, 5, 6], üan: [1, 2, 3, 4, 6],
      iang: [1, 3, 4, 6], uang: [2, 3, 5, 6], iong: [1, 4, 5, 6],
      iao: [3, 4, 5]
    }
    expect(FINALS).toEqual(expected)
  })
})
