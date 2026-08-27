// tests/audio-cells.test.js —— AudioBraille 多方播放（v7 修复）
import { describe, it, expect } from 'vitest'
import { buildChordNotes, buildCellSequence } from '../src/audio-braille.js'

describe('buildChordNotes：只接受单方，拿到多方要归一化', () => {
  it('单方正常', () => {
    const notes = buildChordNotes([1, 4])
    expect(notes).toEqual([
      { dot: 1, freq: 600, wave: 'sine', pan: -90 },
      { dot: 4, freq: 600, wave: 'square', pan: 90 }
    ])
  })
  it('误传多方时取第一方而非产出 undefined 频率（旧 bug：多方静音）', () => {
    const notes = buildChordNotes([[1, 3], [2]])
    expect(notes.every(n => typeof n.freq === 'number')).toBe(true)
    expect(notes.map(n => n.dot)).toEqual([1, 3])
  })
})

describe('buildCellSequence：多方 → 逐方播放序列', () => {
  it('单层视为一方', () => {
    expect(buildCellSequence([1, 3, 4])).toEqual([[1, 3, 4]])
  })
  it('多方保持顺序', () => {
    expect(buildCellSequence([[1, 3, 4], [3, 5], [1]])).toEqual([[1, 3, 4], [3, 5], [1]])
  })
  it('空 → 空', () => {
    expect(buildCellSequence([])).toEqual([])
  })
})
