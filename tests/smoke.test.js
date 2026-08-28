import { describe, it, expect } from 'vitest'
import { createAppState, buildPages, buildTopNav } from '../src/app.js'

describe('v9 AppState', () => {
  it('默认进入 home，输入状态为空', () => {
    const state = createAppState()
    expect(state.page).toBe('home')
    expect(state.input).toEqual({ confirmedCells: [], currentDots: [], cursorIndex: 0 })
  })
})

describe('v9 app shell', () => {
  it('顶层只有四个页面', () => {
    expect(buildPages()).toEqual(['home', 'learning', 'experiment', 'notes'])
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'notes'])
  })
})
