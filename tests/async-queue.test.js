import { describe, it, expect } from 'vitest'
import { createSerialQueue } from '../src/async-queue.js'

describe('实验持久化串行队列', () => {
  it('按入队顺序执行异步任务', async () => {
    const queue = createSerialQueue()
    const events = []
    const first = queue.enqueue(async () => {
      events.push('first:start')
      await new Promise(resolve => setTimeout(resolve, 5))
      events.push('first:end')
    })
    const second = queue.enqueue(async () => {
      events.push('second')
    })
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second'])
  })

  it('前一个任务失败时后续任务仍能执行', async () => {
    const queue = createSerialQueue()
    const second = queue.enqueue(async () => { throw new Error('first failed') })
    const third = queue.enqueue(async () => 'ok')
    await expect(second).rejects.toThrow('first failed')
    await expect(third).resolves.toBe('ok')
  })
})
