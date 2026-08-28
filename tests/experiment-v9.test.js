import { describe, it, expect } from 'vitest'
import { createExperimentModel, getExperimentTabs } from '../src/experiment.js'

describe('v9 AudioBraille 实验模型', () => {
  it('实验包含听觉辨识和听书两个场景', () => {
    expect(getExperimentTabs()).toEqual(['recognition', 'reader'])
  })

  it('模式切换会清理旧一轮状态', () => {
    const model = createExperimentModel({ trialCount: 3 })
    model.start('letters')
    model.confirmShowcase()
    expect(model.snapshot().trials).toHaveLength(3)
    model.selectMode('syllables')
    expect(model.snapshot()).toMatchObject({ mode: 'syllables', stage: 'idle', index: 0, trials: [] })
  })

  it('展示确认后进入题目，重新开始回到第一题', () => {
    const model = createExperimentModel({ trialCount: 3 })
    model.start('syllables')
    expect(model.snapshot().stage).toBe('showcase')
    model.confirmShowcase()
    expect(model.snapshot()).toMatchObject({ stage: 'listen', index: 0 })
    model.restart()
    expect(model.snapshot()).toMatchObject({ stage: 'idle', index: 0, trials: [] })
  })

  it('提交正确的多方答案时保持方序', () => {
    const model = createExperimentModel({ trialCount: 1 })
    model.start('digits')
    model.confirmShowcase()
    const trial = model.snapshot().trials[0]
    const result = model.submit(trial.cells.map(cell => [...cell]))
    expect(result.correct).toBe(true)
    expect(model.snapshot().results[0].correct).toBe(true)
  })
})
