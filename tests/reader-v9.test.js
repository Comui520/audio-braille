import { describe, it, expect } from 'vitest'
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
})
