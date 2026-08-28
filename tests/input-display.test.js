import { describe, it, expect } from 'vitest'
import { buildInputDisplayModel, buildDocumentDisplayModel } from '../src/input-display.js'

describe('输入可视化模型', () => {
  it('当前方的六个点按真实点位点亮', () => {
    expect(buildInputDisplayModel([], [1, 3, 4])).toEqual([
      { kind: 'current', cursor: true, dots: [true, false, true, true, false, false] }
    ])
  })

  it('已确认方和当前方分别显示，保留方边界', () => {
    expect(buildInputDisplayModel([[1, 2], [5]], [4])).toEqual([
      { kind: 'confirmed', cursor: false, dots: [true, true, false, false, false, false] },
      { kind: 'confirmed', cursor: false, dots: [false, false, false, false, true, false] },
      { kind: 'current', cursor: true, dots: [false, false, false, true, false, false] }
    ])
  })

  it('空方光标位于已确认方之间时也可见', () => {
    expect(buildInputDisplayModel([[1], [2]], [], 1)).toEqual([
      { kind: 'confirmed', cursor: false, dots: [true, false, false, false, false, false] },
      { kind: 'current', cursor: true, dots: [false, false, false, false, false, false] },
      { kind: 'confirmed', cursor: false, dots: [false, true, false, false, false, false] }
    ])
  })

  it('组成多方时隐藏下方文档光标', () => {
    expect(buildDocumentDisplayModel([[[1]]], 1, false)).toEqual([
      { kind: 'document', cursor: false, cells: [[true, false, false, false, false, false]] }
    ])
  })
  it('文档显示区只显示已确认单元，并把光标单独放在单元之间', () => {
    expect(buildDocumentDisplayModel([[[1], [2]], null, [[3]]], 1)).toEqual([
      { kind: 'document', cursor: false, cells: [
        [true, false, false, false, false, false],
        [false, true, false, false, false, false]
      ] },
      { kind: 'document-cursor', cursor: true },
      { kind: 'space', cursor: false, text: ' ' },
      { kind: 'document', cursor: false, cells: [[false, false, true, false, false, false]] }
    ])
  })

  it('空输入仍保留一个空的当前方', () => {
    expect(buildInputDisplayModel([], [])).toEqual([
      { kind: 'current', cursor: true, dots: [false, false, false, false, false, false] }
    ])
  })
})
