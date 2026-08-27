// tests/notes.test.js
import { describe, it, expect } from 'vitest'
import { extractDotsFromText, buildPlaybackSequence } from '../src/notes.js'

describe('笔记盲文序列', () => {
  it('从 Unicode 盲文文本提取点位序列', () => {
    // ⠍ = 134，⠛ = 1245（内联真实盲文字符）
    const text = '⠍⠛'
    expect(extractDotsFromText(text)).toEqual([[1, 3, 4], [1, 2, 4, 5]])
  })
  it('忽略空白/标点/汉字，只取盲文方', () => {
    const text = '你好 ⠍，世界！\u2800'
    const seq = extractDotsFromText(text)
    expect(seq).toEqual([[1, 3, 4], []])
  })
  it('buildPlaybackSequence 把点位序列展开为逐方播放数组', () => {
    const seq = buildPlaybackSequence([[1, 3, 4], [3, 5], [1]])
    expect(seq).toHaveLength(3)
    expect(seq[0]).toEqual([1, 3, 4])
  })
})
