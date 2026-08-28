import { describe, it, expect } from 'vitest'
import { appendSpace } from '../src/app.js'

describe('空格输入', () => {
  it('在盲文文本末尾插入普通空格', () => {
    expect(appendSpace('⠁⠃')).toBe('⠁⠃ ')
  })
})
