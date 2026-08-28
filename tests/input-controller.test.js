import { describe, it, expect } from 'vitest'
import { createInputController } from '../src/input.js'

describe('v9 可控逐方输入器', () => {
  it('点位键只更新当前方，不触发语音', () => {
    const speeches = []
    const input = createInputController({ onSpeech: text => speeches.push(text) })
    input.handleKey('7')
    input.handleKey('1')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [1, 3] })
    expect(speeches).toEqual([])
  })

  it('* 确认当前方并开始下一方', () => {
    const input = createInputController()
    input.handleKey('7')
    input.handleKey('1')
    expect(input.handleKey('*')).toBe(true)
    expect(input.snapshot()).toMatchObject({ confirmedCells: [[1, 3]], currentDots: [] })
  })

  it('0 提交时保留每一方边界', () => {
    const commits = []
    const input = createInputController({ onCommit: cells => commits.push(cells) })
    input.handleKey('7')
    input.handleKey('*')
    input.handleKey('4')
    input.handleKey('0')
    expect(commits).toEqual([[[1], [2]]])
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [] })
  })

  it('3 清当前方；当前方为空时回退上一方', () => {
    const input = createInputController()
    input.handleKey('7')
    input.handleKey('*')
    input.handleKey('4')
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [[1]], currentDots: [] })
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [1] })
  })

  it('组合键不被控制器消费，Ctrl+R 可以交给浏览器', () => {
    const input = createInputController()
    expect(input.handleKey('r', { ctrlKey: true })).toBe(false)
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [] })
  })
})
