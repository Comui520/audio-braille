import { describe, it, expect } from 'vitest'
import { editorTextToAtoms, editorAtomsToText, editorCursorToOffset, editorOffsetToCursor } from '../src/app.js'

describe('textarea 盲文文档转换', () => {
  it('盲文文档单元转换为连续 textarea 文本', () => {
    const atoms = [[[2, 3, 4, 5]], null, { kind: 'text', value: '\n' }, [[1, 4]]]
    expect(editorAtomsToText(atoms)).toBe('⠞ \n⠉')
  })

  it('文档光标按单元边界转换为 textarea 字符偏移', () => {
    const atoms = [[[2, 3, 4, 5]], null, { kind: 'text', value: '\n' }, [[1, 4]]]
    expect(editorCursorToOffset(atoms, 0)).toBe(0)
    expect(editorCursorToOffset(atoms, 1)).toBe(1)
    expect(editorCursorToOffset(atoms, 2)).toBe(2)
    expect(editorCursorToOffset(atoms, 3)).toBe(3)
    expect(editorCursorToOffset(atoms, 4)).toBe(4)
  })

  it('textarea 字符偏移可还原为最近的文档单元光标', () => {
    const atoms = [[[2, 3, 4, 5]], null, { kind: 'text', value: '\n' }, [[1, 4]]]
    expect(editorOffsetToCursor(atoms, 0)).toBe(0)
    expect(editorOffsetToCursor(atoms, 1)).toBe(1)
    expect(editorOffsetToCursor(atoms, 2)).toBe(2)
    expect(editorOffsetToCursor(atoms, 3)).toBe(3)
    expect(editorOffsetToCursor(atoms, 4)).toBe(4)
  })
  it('直接编辑的换行会保留为普通文本单元', () => {
    expect(editorTextToAtoms('⠞\n⠉')).toEqual([
      [[2, 3, 4, 5]],
      { kind: 'text', value: '\n' },
      [[1, 4]]
    ])
  })
})
