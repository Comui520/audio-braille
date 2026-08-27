// tests/smoke.test.js
import { describe, it, expect } from 'vitest'
import { createAppState, buildPages } from '../src/app.js'

describe('AppState', () => {
  it('初始化时 currentPage 为 home，brailleDots 为 6 位 false', () => {
    const state = createAppState()
    expect(state.currentPage).toBe('home')
    expect(state.brailleDots).toEqual([false, false, false, false, false, false])
  })

  it('setDots 切换指定位并返回新数组（不可变更新）', () => {
    const state = createAppState()
    state.setDots(0)  // 点亮点1
    expect(state.brailleDots[0]).toBe(true)
    state.setDots(0)  // 再按熄灭
    expect(state.brailleDots[0]).toBe(false)
  })
})

describe('app 接口', () => {
  it('buildPages 返回七个页面名（含首页/说明/听书）', () => {
    expect(buildPages()).toEqual(['home', 'guide', 'teaching', 'input', 'experiment', 'notes', 'reader'])
  })
})
