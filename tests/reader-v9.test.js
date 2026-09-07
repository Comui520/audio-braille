import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/audio-braille.js', () => ({
  playAudioBraille: vi.fn(() => new Promise(resolve => setTimeout(resolve, 5)))
}))

import { createReader } from '../src/reader.js'

describe('v9 reader lifecycle', () => {
  it('初始状态未播放', () => {
    const reader = createReader()
    expect(reader.snapshot()).toMatchObject({ playing: false, speed: 1 })
  })

  it('速度被限制在 0.5 到 5', () => {
    const reader = createReader()
    reader.setSpeed(9)
    expect(reader.snapshot().speed).toBe(5)
    reader.setSpeed(0)
    expect(reader.snapshot().speed).toBe(0.5)
  })

  it('stop 会立即结束播放状态', () => {
    const reader = createReader()
    reader.stop()
    expect(reader.snapshot().playing).toBe(false)
  })

  it('停止播放不会触发完成回调，暂停会累计次数', async () => {
    let completed = 0
    const reader = createReader({ onComplete: () => { completed += 1 } })
    const pending = reader.play('ma ma ma')
    reader.pause()
    expect(reader.snapshot().pauseCount).toBe(1)
    reader.stop()
    await pending
    expect(completed).toBe(0)
    expect(reader.snapshot().playing).toBe(false)
  })
})
