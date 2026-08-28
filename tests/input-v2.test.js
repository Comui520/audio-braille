// tests/input-v2.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveInputMode, KEY_DOT_MAP, keyToDot } from '../src/input.js'
import { dotsToLatin, latinToUnicode } from '../src/braille-engine.js'

// Node 环境无 localStorage，用内存代理
const mem = new Map()
beforeEach(() => {
  mem.clear()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v))
  }
})

describe('英文优先输入模式', () => {
  it('语言由调用层传入，不读取浏览器存储', () => {
    expect(resolveInputMode({ language: 'en' })).toBe('latin')
    expect(resolveInputMode({ language: 'zh' })).toBe('pinyin')
    expect(resolveInputMode({ language: 'zh', pinyinMode: false })).toBe('latin')
  })
  it('键位映射不变（官方布局）', () => {
    expect(KEY_DOT_MAP['7']).toBe(0)
    expect(KEY_DOT_MAP['2']).toBe(5)
    expect(keyToDot('0')).toBe(null)
  })
  it('latin 模式点位 → 字母直出', () => {
    expect(dotsToLatin([1, 3, 4])).toBe('m')
    // m = 点1,3,4 → 掩码 0x01+0x04+0x08 = 0x0D → U+280D（⠍）
    expect(latinToUnicode('m')).toBe('\u280d')
  })
})
