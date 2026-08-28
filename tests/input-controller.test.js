import { describe, it, expect } from 'vitest'
import { createInputController } from '../src/input.js'

describe('v9 可控逐方输入器', () => {
  it('点位键只更新当前方，不触发语音', () => {
    const speeches = []
    const input = createInputController({ onSpeech: text => speeches.push(text) })
    input.handleKey('7')
    input.handleKey('1')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [1, 3], cursorIndex: 0 })
    expect(speeches).toEqual([])
  })

  it('* 确认当前方并移动到下一方', () => {
    const input = createInputController()
    input.handleKey('7')
    input.handleKey('1')
    expect(input.handleKey('*')).toBe(true)
    expect(input.snapshot()).toMatchObject({ confirmedCells: [[1, 3]], currentDots: [], cursorIndex: 1 })
  })

  it('光标可以在已确认方之间移动并修改旧方', () => {
    const input = createInputController()
    input.handleKey('7'); input.handleKey('*')
    input.handleKey('4'); input.handleKey('*')
    expect(input.snapshot().confirmedCells).toEqual([[1], [2]])
    input.handleKey('/')
    input.handleKey('/')
    expect(input.snapshot().cursorIndex).toBe(0)
    input.handleKey('1')
    input.handleKey('*')
    expect(input.snapshot().confirmedCells).toEqual([[3], [2]])
  })

  it('0 提交时保留每一方边界', () => {
    const commits = []
    const input = createInputController({ onCommit: cells => commits.push(cells) })
    input.handleKey('7')
    input.handleKey('*')
    input.handleKey('4')
    input.handleKey('0')
    expect(commits).toEqual([[[1], [2]]])
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [], cursorIndex: 0 })
  })

  it('3 真正删除光标前的方；无内容时通知协调层删除已上屏内容', () => {
    const deleted = []
    const input = createInputController({ onBackspace: () => deleted.push(true) })
    input.handleKey('7'); input.handleKey('*')
    input.handleKey('4'); input.handleKey('*')
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [[1]], cursorIndex: 1 })
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], cursorIndex: 0 })
    input.handleKey('3')
    expect(deleted).toEqual([true])
  })

  it('组合键不被控制器消费，Ctrl+R 可以交给浏览器', () => {
    const input = createInputController()
    expect(input.handleKey('r', { ctrlKey: true })).toBe(false)
    expect(input.snapshot()).toMatchObject({ confirmedCells: [], currentDots: [] })
  })
})
