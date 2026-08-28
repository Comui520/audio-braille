import { describe, it, expect } from 'vitest'
import { appendCommittedBraille } from '../src/app.js'

describe('笔记输入提交', () => {
  it('提交方后追加 Unicode，并保留已有文本', () => {
    expect(appendCommittedBraille('⠁', [[1, 2]])).toBe('⠁⠃')
  })
  it('多方提交保持方序', () => {
    expect(appendCommittedBraille('', [[1, 3, 4], [3, 5], [1]])).toBe('⠍⠔⠁')
  })
})
