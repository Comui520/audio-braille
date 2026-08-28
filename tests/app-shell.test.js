import { describe, it, expect } from 'vitest'
import { buildTopNav, buildHomeActions } from '../src/app.js'

describe('v9 应用壳', () => {
  it('顶层导航只有四项', () => {
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'notes'])
  })

  it('首页入口只保留学习、实验和笔记', () => {
    expect(buildHomeActions().map(item => item.action)).toEqual(['learning', 'experiment', 'notes'])
  })
})
