import { describe, it, expect } from 'vitest'
import { buildTeachingSpeech } from '../src/teaching-speech.js'

describe('v9 教学语音策略', () => {
  it('声母使用描述式文案和点位，不只朗读裸字母', () => {
    const text = buildTeachingSpeech({ type: 'initial', label: 'b', cells: [[1, 2]] })
    expect(text).toContain('声母')
    expect(text).toContain('点1、点2')
    expect(text).not.toBe('b')
  })

  it('韵母使用描述式文案', () => {
    const text = buildTeachingSpeech({ type: 'final', label: 'a', cells: [[3, 5]] })
    expect(text).toContain('韵母')
    expect(text).toContain('点3、点5')
  })

  it('多方音节说明声调和方数', () => {
    const text = buildTeachingSpeech({
      type: 'syllable', label: 'ma', toneName: '阴平',
      cells: [[1, 3, 4], [3, 5], [1]]
    })
    expect(text).toContain('音节 ma')
    expect(text).toContain('阴平')
    expect(text).toContain('3方')
  })

  it('其他项目也包含可理解的类型和点位', () => {
    expect(buildTeachingSpeech({ type: 'letter', label: 'a', cells: [[1]] }))
      .toContain('英文字母 a')
    expect(buildTeachingSpeech({ type: 'digit', label: '2', cells: [[3, 4, 5, 6], [1, 2]] }))
      .toContain('数字 2')
  })
})
