// tests/notes-v5.test.js
import { describe, it, expect } from 'vitest'
import { buildPlaybackSequence, plainToSpeech, extractDotsFromText } from '../src/notes.js'

describe('笔记双模式朗读（v5）', () => {
  it('plainToSpeech：盲文文本 → TTS 可读文本（拉丁字母）', () => {
    // ⠍ = m，⠛ = g
    expect(plainToSpeech('⠍⠛')).toBe('m g')
  })
  it('plainToSpeech：无法解析的方用 · 占位', () => {
    // ⠀ = 空方 → 无拉丁 → ·
    expect(plainToSpeech('⠀')).toBe('·')
  })
  it('buildPlaybackSequence 保留（逐方播放）', () => {
    expect(buildPlaybackSequence([[1, 3, 4]])).toEqual([[1, 3, 4]])
  })
  it('extractDotsFromText 保留（提取盲文方）', () => {
    expect(extractDotsFromText('⠍⠛')).toEqual([[1, 3, 4], [1, 2, 4, 5]])
  })
})