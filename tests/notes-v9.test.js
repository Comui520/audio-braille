import { describe, it, expect } from 'vitest'
import { getNotePlaybackLabel, buildNotePlaybackCells } from '../src/notes.js'

describe('v9 笔记朗读', () => {
  it('两个按钮名称明确区分', () => {
    expect(getNotePlaybackLabel('tts')).toContain('文字')
    expect(getNotePlaybackLabel('braille')).toContain('AudioBraille')
  })

  it('AudioBraille 回放按方拆开', () => {
    expect(buildNotePlaybackCells('⠍⠔⠁')).toEqual([[1, 3, 4], [3, 5], [1]])
  })

  it('无盲文字符时返回空序列', () => {
    expect(buildNotePlaybackCells('普通文字')).toEqual([])
  })
})
