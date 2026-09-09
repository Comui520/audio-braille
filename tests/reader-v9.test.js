import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/audio-braille.js', () => ({
  playAudioBraille: vi.fn(() => new Promise(resolve => setTimeout(resolve, 5)))
}))

import { createReader } from '../src/reader.js'

describe('v9 reader lifecycle', () => {
  it('初始状态未播放', () => {
    const reader = createReader()
    expect(reader.snapshot()).toMatchObject({ playing: false, speed: 1, generation: expect.any(Number) })
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


  it('完成回调携带本次播放 generation，便于忽略旧播放回调', async () => {
    let completion = null
    const reader = createReader({ onComplete: info => { completion = info } })
    await reader.play([[1]])
    expect(completion).toMatchObject({ generation: expect.any(Number) })
  })
  it('逐方播放回调提供稳定的方索引，并在完成后清理当前方', async () => {
    const starts = []
    const ends = []
    const reader = createReader({ onCellStart: (index, cell) => starts.push([index, cell]), onCellComplete: index => ends.push(index) })
    await reader.play([[1], [2, 3]])
    expect(starts.map(item => item[0])).toEqual([0, 1])
    expect(starts[1][1]).toEqual([2, 3])
    expect(ends).toEqual([0, 1])
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
