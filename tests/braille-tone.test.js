// tests/braille-tone.test.js
import { describe, it, expect } from 'vitest'
import { smartTone, applyToneReduction, syllableToDots } from '../src/braille-engine.js'

describe('国家通用盲文声调省写（smartTone）', () => {
  it('常规：f 声母省阴平(1)', () => {
    // f 声母音节省去阴平 → 声调返回 0（省写）
    expect(smartTone('f', 'a', '1')).toBe(0)
    expect(smartTone('f', 'e', '1')).toBe(0)
  })
  it('常规：p/m/t/n/h/q/ch/r/c 省阳平(2)', () => {
    const reduce2 = ['p', 'm', 't', 'n', 'h', 'q', 'ch', 'r', 'c']
    reduce2.forEach(ini => {
      expect(smartTone(ini, 'a', '2')).toBe(0)
    })
  })
  it('常规：b/d/l/g/k/j/x/zh/sh/z/s 省去声(4)', () => {
    const reduce4 = ['b', 'd', 'l', 'g', 'k', 'j', 'x', 'zh', 'sh', 'z', 's']
    reduce4.forEach(ini => {
      expect(smartTone(ini, 'a', '4')).toBe(0)
    })
  })
  it('常规：韵母自成音节（零声母）省去声(4)', () => {
    expect(smartTone('', 'i', '4')).toBe(0)
    expect(smartTone('', 'u', '4')).toBe(0)
  })
  it('非省写声调保留原调', () => {
    expect(smartTone('b', 'a', '1')).toBe('1')
    expect(smartTone('f', 'a', '2')).toBe('2')
    expect(smartTone('p', 'a', '1')).toBe('1')
    expect(smartTone('l', 'a', '1')).toBe('1')
  })
})

describe('特别/边界（国家通用盲文）', () => {
  it('韵母自成仅省去声(4)，其他声调保留', () => {
    expect(smartTone('', 'i', '4')).toBe(0)   // 去声省
    expect(smartTone('', 'i', '1')).toBe('1') // 阴平保留
    expect(smartTone('', 'er', '2')).toBe('2') // 阳平保留（ér 二）
    expect(smartTone('', 'uo', '3')).toBe('3') // 上声保留
  })
  it('l 声母去声省写（lè 例外不在此基础规则）', () => {
    expect(smartTone('l', 'e', '4')).toBe(0)
  })
})

describe('applyToneReduction & syllableToDots 应用省写', () => {
  it('m+a+阴平：m 省阳平不适用，阴平保留 → 3方', () => {
    expect(syllableToDots('m', 'a', '1')).toEqual([[1, 3, 4], [3, 5], [1]])
  })
  it('f+a+阴平：f 省阴平 → 仅 2 方', () => {
    expect(syllableToDots('f', 'a', '1')).toEqual([[1, 2, 4], [3, 5]])
  })
  it('b+a+去声：b 省去声 → 仅 2 方', () => {
    expect(syllableToDots('b', 'a', '4')).toEqual([[1, 2], [3, 5]])
  })
  it('b+a+阴平：b 不省阴平 → 3方', () => {
    expect(syllableToDots('b', 'a', '1')).toEqual([[1, 2], [3, 5], [1]])
  })
})