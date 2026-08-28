import { describe, it, expect } from 'vitest'
import {
  TOP_LEVEL_PAGES,
  createAppState,
  navigate,
  selectLearningTab,
  selectExperimentTab,
  setTeachingLocation
} from '../src/app-state.js'

describe('v9 app state', () => {
  it('默认进入首页并使用四个顶层入口', () => {
    const state = createAppState()
    expect(TOP_LEVEL_PAGES).toEqual(['home', 'learning', 'experiment', 'notes'])
    expect(state.page).toBe('home')
    expect(state.learningTab).toBe('teaching')
    expect(state.experimentTab).toBe('recognition')
  })

  it('导航只接受有效页面', () => {
    expect(navigate(createAppState(), 'learning').page).toBe('learning')
    expect(navigate(createAppState(), 'reader').page).toBe('home')
  })

  it('标签切换不改变顶层页面', () => {
    const state = navigate(createAppState(), 'experiment')
    const experimentState = selectExperimentTab(state, 'reader')
    expect(experimentState).toMatchObject({
      page: 'experiment',
      experimentTab: 'reader'
    })
    expect(selectLearningTab(experimentState, 'input')).toMatchObject({
      page: 'experiment',
      experimentTab: 'reader',
      learningTab: 'input'
    })
  })

  it('教学位置可以逐层更新', () => {
    const state = createAppState()
    const next = setTeachingLocation(state, {
      category: 'latin', section: 'l1', item: 'f', phase: 'learn'
    })
    expect(next.teaching).toEqual({ category: 'latin', section: 'l1', item: 'f', phase: 'learn' })
    expect(state.teaching).toEqual({ category: null, section: null, item: null, phase: 'learn' })
  })
})
