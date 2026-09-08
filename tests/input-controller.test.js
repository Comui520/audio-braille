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

  it('重复按同一点位键会取消该点，同时保留其他点', () => {
    const input = createInputController()
    input.handleKey('1')
    expect(input.snapshot().currentDots).toEqual([3])

    input.handleKey('7')
    expect(input.snapshot().currentDots).toEqual([1, 3])

    input.handleKey('1')
    expect(input.snapshot().currentDots).toEqual([1])

    input.handleKey('7')
    expect(input.snapshot().currentDots).toEqual([])
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

  it('文档模式把当前多方组合在 0 时作为一个单元写入文档', () => {
    const input = createInputController({ mode: 'document' })
    for (const key of ['4', '1', '8', '5']) input.handleKey(key)
    input.handleKey('*')
    expect(input.snapshot()).toMatchObject({
      confirmedCells: [[2, 3, 4, 5]],
      currentDots: [],
      cursorIndex: 1,
      documentCells: [],
      documentCursor: 0
    })
    input.handleKey('/')
    input.handleKey('/')
    expect(input.snapshot().cursorIndex).toBe(0)
    input.handleKey('*')
    expect(input.snapshot().cursorIndex).toBe(1)
    input.handleKey('0')
    expect(input.snapshot()).toMatchObject({
      confirmedCells: [],
      currentDots: [],
      cursorIndex: 0,
      documentCells: [[[2, 3, 4, 5]]],
      documentCursor: 1
    })
  })

  it('文档模式的星号和斜杠在多方确认后移动文档单元光标', () => {
    const input = createInputController({ mode: 'document' })
    for (const key of ['4', '1', '8', '5', '0', '7', '8', '0']) input.handleKey(key)
    expect(input.snapshot().documentCells).toEqual([[[2, 3, 4, 5]], [[1, 4]]])
    input.handleKey('/')
    expect(input.snapshot().documentCursor).toBe(1)
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({
      documentCells: [[[1, 4]]],
      documentCursor: 0
    })
  })

  it('文档模式在文档光标处插入新单元而不是覆盖右侧单元', () => {
    const input = createInputController({ mode: 'document' })
    for (const key of ['7', '0', '8', '0']) input.handleKey(key)
    input.handleKey('/')
    for (const key of ['7', '0']) input.handleKey(key)
    expect(input.snapshot()).toMatchObject({
      documentCells: [[[1]], [[1]], [[4]]],
      documentCursor: 2
    })
  })

  it('文档模式的句点插入空格单元且退格可以删除它', () => {
    const input = createInputController({ mode: 'document' })
    input.handleKey('7')
    input.handleKey('0')
    input.handleKey('.')
    expect(input.snapshot().documentCells).toEqual([[[1]], null])
    input.handleKey('3')
    expect(input.snapshot()).toMatchObject({ documentCells: [[[1]]], documentCursor: 1 })
  })
})
