import { describe, it, expect } from 'vitest'
import {
  getTeachingCategories,
  getTeachingSections,
  getTeachingItems,
  getTeachingItem,
  markTeachingLearned,
  buildItemSpeech
} from '../src/teaching.js'

describe('v12 教学层级', () => {
  it('只有四个平级大区域', () => {
    expect(getTeachingCategories().map(item => item.id))
      .toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })

  it('中文拼音的细项可以独立进入', () => {
    expect(getTeachingSections('pinyin').map(item => item.id))
      .toEqual(['initials', 'finals', 'syllables'])
  })

  it('可以直接取得任意项目，不依赖前序项目', () => {
    const item = getTeachingItem('latin', 'l1', 'f')
    expect(item).toMatchObject({ id: 'latin.l1.f', label: 'f', type: 'letter' })
    expect(item.cells).toEqual([[1, 2, 4]])
    expect(item.unicode).toBe('⠋')
  })

  it('多方项目保留声韵调或数字符号边界', () => {
    expect(getTeachingItem('pinyin', 'syllables', 'ma1').cells).toEqual([[1, 3, 4], [3, 5], [1]])
    expect(getTeachingItem('digits', 'd1', '2').cells).toEqual([[3, 4, 5, 6], [1, 2]])
  })

  it('基础音节默认无调，单项声调可以覆盖', () => {
    expect(getTeachingItem('pinyin', 'syllables', 'ba').cells)
      .toEqual([[1, 2], [3, 5]])
    expect(getTeachingItem('pinyin', 'syllables', 'ba', 'zh', '1'))
      .toEqual(expect.objectContaining({ tone: '1', toneName: '阴平', cells: [[1, 2], [3, 5], [1]] }))
  })

  it('复杂韵母和零声母别名可以生成盲文', () => {
    expect(getTeachingItem('pinyin', 'syllables', 'bing').cells).toHaveLength(2)
    expect(getTeachingItem('pinyin', 'syllables', 'guang').cells).toHaveLength(2)
    expect(getTeachingItem('pinyin', 'syllables', 'yuan').cells).toHaveLength(1)
    expect(getTeachingItem('pinyin', 'syllables', 'ying').cells).toHaveLength(1)
  })

  it('教学列表包含当前进度而不改变课程顺序', () => {
    const items = getTeachingItems('latin', 'l1', { learned: ['a'], current: 'f' })
    expect(items[0]).toMatchObject({ label: 'a', learned: true })
    expect(items[5]).toMatchObject({ label: 'f', current: true })
  })

  it('标记项目后 current 指向下一个未学项目', () => {
    expect(markTeachingLearned({ learned: [], current: null }, 'a', ['a', 'b']))
      .toEqual({ learned: ['a'], current: 'b' })
  })

  it('声母和韵母使用描述式语音，音节包含声调名称', () => {
    expect(buildItemSpeech(getTeachingItem('pinyin', 'initials', 'b'))).toContain('声母')
    expect(buildItemSpeech(getTeachingItem('pinyin', 'finals', 'a'))).toContain('韵母')
    expect(buildItemSpeech(getTeachingItem('pinyin', 'syllables', 'ma1'))).toContain('阴平')
  })
})
