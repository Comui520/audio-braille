// tests/notes-v2.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { extractDotsFromText, buildPlainReference } from '../src/notes.js'

// Node 无 localStorage，注入内存代理
const mem = new Map()
beforeEach(() => {
  mem.clear()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v))
  }
})

describe('笔记盲文序列（保留）', () => {
  it('从 Unicode 盲文文本提取点位序列', () => {
    const text = '⠍⠛'
    expect(extractDotsFromText(text)).toEqual([[1, 3, 4], [1, 2, 4, 5]])
  })
  it('忽略空白/标点/汉字，只取盲文方', () => {
    const text = '你好 ⠍，世界！\u2800'
    const seq = extractDotsFromText(text)
    expect(seq).toEqual([[1, 3, 4], []])
  })
})

describe('明文对照显示（v2 新增）', () => {
  it('英文模式：盲文方 → 拉丁字母', () => {
    mem.set('AudioBraille.lang', 'en')
    const refs = buildPlainReference([[1, 3, 4], [1, 2, 4, 5]])
    expect(refs[0].char).toBe('m')
    expect(refs[1].char).toBe('g')
    expect(refs[0].unicode).toBe('\u280d')
  })
  it('中文模式：也显示拉丁字母（国际标准）', () => {
    mem.set('AudioBraille.lang', 'zh')
    const refs = buildPlainReference([[1, 3, 4]])
    expect(refs[0].char).toBe('m')
  })
  it('数字符号方（3456）显示为 #', () => {
    mem.set('AudioBraille.lang', 'zh')
    const refs = buildPlainReference([[3, 4, 5, 6]])
    expect(refs[0].char).toBe('#')
  })
  it('无法解析的方 char 为 null', () => {
    mem.set('AudioBraille.lang', 'zh')
    const refs = buildPlainReference([[5]])
    expect(refs[0].char).toBeNull()
  })
})
