import { describe, it, expect } from 'vitest'
import { createInputController } from '../src/input.js'
import { buildReadingDots, SAMPLE_BRAILLE } from '../src/reader.js'

describe('v9 共享输入退格和盲文听书输入', () => {
  it('3 在输入缓冲为空时通知协调层删除已上屏内容', () => {
    const deleted = []
    const input = createInputController({ onBackspace: () => deleted.push(true) })
    expect(input.handleKey('3')).toBe(true)
    expect(deleted).toEqual([true])
  })

  it('听书示例本身是 Unicode 盲文，播放序列可直接解析盲文', () => {
    expect(SAMPLE_BRAILLE).toMatch(/[\u2800-\u28ff]/)
    expect(buildReadingDots(SAMPLE_BRAILLE).length).toBeGreaterThan(0)
    expect(buildReadingDots('⠍⠔⠁')).toEqual([[1, 3, 4], [3, 5], [1]])
  })
})
