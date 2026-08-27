// tests/braille-engine.test.js
import { describe, it, expect } from 'vitest'
import {
  INITIALS, FINALS, TONES,
  dotsToUnicode, unicodeToDots,
  applyVariation, syllableToDots, dotsToComponent
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
