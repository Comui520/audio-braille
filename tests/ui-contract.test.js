import { describe, it, expect } from 'vitest'
import { UI_TOKENS, navClassFor } from '../src/ui-contract.js'

describe('v9 UI contract', () => {
  it('使用明亮中性色而非旧深色主题', () => {
    expect(UI_TOKENS.page).toBe('#f6f7f9')
    expect(UI_TOKENS.text).toBe('#20242a')
    expect(UI_TOKENS.surface).toBe('#ffffff')
  })

  it('当前导航有明确 active 状态', () => {
    expect(navClassFor('learning', 'learning')).toContain('is-active')
    expect(navClassFor('home', 'learning')).not.toContain('is-active')
  })
})
