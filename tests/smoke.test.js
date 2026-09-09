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
  it('顶层包含独立体验听书页面', () => {
    expect(buildPages()).toEqual(['home', 'learning', 'experiment', 'reader', 'notes'])
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'reader', 'notes'])
  })
})

