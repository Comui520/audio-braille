// tests/audio-braille.test.js
import { describe, it, expect } from 'vitest'
import { buildChordNotes, PAN } from '../src/audio-braille.js'

describe('AudioBraille 编码（纯逻辑）', () => {
  it('点1 → 600Hz 正弦 左耳', () => {
    const notes = buildChordNotes([1])
    expect(notes).toEqual([{ dot: 1, freq: 600, wave: 'sine', pan: PAN.LEFT }])
  })
  it('点6 → 250Hz 方波 右耳', () => {
    const notes = buildChordNotes([6])
    expect(notes).toEqual([{ dot: 6, freq: 250, wave: 'square', pan: PAN.RIGHT }])
  })
  it('点1+点4 同音高（上行 600Hz）但波形不同（左右列区分）', () => {
    const notes = buildChordNotes([1, 4])
    expect(notes.find(n => n.dot === 1).wave).toBe('sine')
    expect(notes.find(n => n.dot === 4).wave).toBe('square')
    expect(notes.find(n => n.dot === 1).freq).toBe(notes.find(n => n.dot === 4).freq)
  })
  it('空点阵返回空数组', () => {
    expect(buildChordNotes([])).toEqual([])
  })
})
