// tests/braille-pinyin.test.js
import { describe, it, expect } from 'vitest'
import { dotsSeqToPinyin, applyToneMark, formatPinyinReference } from '../src/braille-engine.js'

describe('声调符号标注（applyToneMark）', () => {
  it('a + 各声调', () => {
    expect(applyToneMark('a', '1')).toBe('ā')
    expect(applyToneMark('a', '2')).toBe('á')
    expect(applyToneMark('a', '3')).toBe('ǎ')
    expect(applyToneMark('a', '4')).toBe('à')
  })
  it('复韵母主元音优先 a/o/e', () => {
    expect(applyToneMark('ao', '3')).toBe('ǎo')
    expect(applyToneMark('ie', '2')).toBe('ié')
    expect(applyToneMark('uan', '4')).toBe('uàn')
  })
  it('无 a/o/e 时用 i/u/ü', () => {
    expect(applyToneMark('iu', '1')).toBe('īu')
    expect(applyToneMark('in', '3')).toBe('ǐn')
  })
  it('无声调原样返回', () => {
    expect(applyToneMark('a', null)).toBe('a')
  })
})

describe('拼音对照显示格式化', () => {
  it('完整 ma1 继续显示带调拼音', () => {
    expect(formatPinyinReference([[1, 3, 4], [3, 5], [1]])).toBe('mā')
  })

  it('完整无调 ma 显示无调拼音', () => {
    expect(formatPinyinReference([[1, 3, 4], [3, 5]])).toBe('ma')
  })

  it('完整零声母 i1 保留现有 yī 规则', () => {
    expect(formatPinyinReference([[2, 4], [1]])).toBe('yī')
  })

  it('单独声母显示声母本身', () => {
    expect(formatPinyinReference([[1, 3, 4]])).toBe('m')
  })

  it('单独声调显示正式名称', () => {
    expect(formatPinyinReference([[1]])).toBe('（阴平）')
    expect(formatPinyinReference([[2]])).toBe('（阳平）')
    expect(formatPinyinReference([[3]])).toBe('（上声）')
    expect(formatPinyinReference([[2, 3]])).toBe('（去声）')
  })

  it('未知方仍显示占位符', () => {
    expect(formatPinyinReference([[5]])).toBe('·')
  })
})
describe('盲文方序列 → 拼音（v6 明文对照）', () => {
  it('ma1（声母m+韵母a+阴平）→ mā', () => {
    expect(dotsSeqToPinyin([[1, 3, 4], [3, 5], [1]])).toBe('mā')
  })
  it('ma3 → mǎ', () => {
    expect(dotsSeqToPinyin([[1, 3, 4], [3, 5], [3]])).toBe('mǎ')
  })
  it('无调 ma → ma', () => {
    expect(dotsSeqToPinyin([[1, 3, 4], [3, 5]])).toBe('ma')
  })
  it('零声母（韵母自成）i+阴平 → yī', () => {
    expect(dotsSeqToPinyin([[2, 4], [1]])).toBe('yī')
  })
  it('变读 g+i → ji（g/k/h 与 i 相拼变 j/q/x）', () => {
    expect(dotsSeqToPinyin([[1, 2, 4, 5], [2, 4]])).toBe('ji')
  })
  it('e/o 共用点位 26（规格已知歧义）→ 解析为 o', () => {
    // 规格第 2.3 节：e 与 o 共用点位 26，单方无法区分，取表中先出现者
    expect(dotsSeqToPinyin([[1, 2, 3], [2, 6], [2, 3]])).toBe('lò')
  })
  it('无法解析的方返回 · 占位', () => {
    expect(dotsSeqToPinyin([[5]])).toBe('·')
  })
  it('多个音节拼接：mā + hǎo', () => {
    expect(dotsSeqToPinyin([[1, 3, 4], [3, 5], [1], [1, 2, 5], [2, 3, 5], [3]])).toBe('māhǎo')
  })
})
