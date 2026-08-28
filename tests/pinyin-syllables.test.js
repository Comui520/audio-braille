import { describe, it, expect } from 'vitest'
import { PINYIN_SYLLABLES } from '../src/data/pinyin-syllables.js'
import { CURRICULUM } from '../src/curriculum.js'

describe('基础普通话音节清单', () => {
  it('包含 391 个唯一的无声调基础音节', () => {
    expect(PINYIN_SYLLABLES).toHaveLength(391)
    expect(new Set(PINYIN_SYLLABLES).size).toBe(391)
    expect(PINYIN_SYLLABLES.every(item => !/[1-4]$/.test(item))).toBe(true)
  })

  it('覆盖复杂韵母音节', () => {
    for (const item of ['bing', 'ying', 'guang', 'huang', 'jiong', 'qiong', 'bian', 'xian', 'yuan', 'juan', 'xuan']) {
      expect(PINYIN_SYLLABLES).toContain(item)
    }
  })

  it('课程列表直接使用基础清单', () => {
    const items = CURRICULUM.pinyin.sections.find(section => section.id === 'syllables').items
    expect(items).toBe(PINYIN_SYLLABLES)
    expect(items).not.toContain('ba1')
    expect(items).toContain('guang')
  })
})
