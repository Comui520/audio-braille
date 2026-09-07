import { describe, it, expect } from 'vitest'
import { createExperimentModel, getExperimentTabs } from '../src/experiment.js'

describe('v9 AudioBraille 实验模型', () => {
  it('实验包含听觉辨识和听书两个场景', () => {
    expect(getExperimentTabs()).toEqual(['recognition', 'reader'])
  })

  it('正式题目带有 stimulusId 和大题库元数据', () => {
    const model = createExperimentModel({
      trialCount: 2,
      dataClass: 'formal',
      studyVersion: 'v13-1',
      consentAccepted: true,
      participantId: 'participant-1',
      sessionId: 'session-1'
    })
    model.start('syllables', { seed: 'test-seed', phase: 'formal' })
    const trials = model.snapshot().trials
    expect(trials).toHaveLength(2)
    expect(trials.every(trial => trial.stimulusId && trial.bankVersion && trial.difficultyStratum)).toBe(true)
  })

  it('formal 会话记录刺激 ID、研究版本、阶段、反应时间和重听次数', () => {
    const model = createExperimentModel({
      trialCount: 1,
      dataClass: 'formal',
      studyVersion: 'v13-1',
      consentAccepted: true,
      participantId: 'participant-1',
      sessionId: 'session-1'
    })
    model.start('syllables', { seed: 'test-seed', phase: 'formal' })
    model.confirmShowcase()
    model.listen(1000)
    const trial = model.snapshot().trials[0]
    const result = model.submit(trial.cells.map(cell => [...cell]), {
      submittedAt: 1200,
      replayCount: 2
    })
    expect(result.record).toMatchObject({
      stimulusId: trial.stimulusId,
      bankVersion: trial.bankVersion,
      phase: 'formal',
      studyVersion: 'v13-1',
      replayCount: 2,
      reactionTimeMs: 200
    })
  })

  it('formal 会话没有同意或身份字段时不能开始', () => {
    const model = createExperimentModel({ dataClass: 'formal', studyVersion: 'v13-1' })
    const state = model.start('letters', { seed: 'blocked' })
    expect(state.stage).toBe('idle')
    expect(state.blocked).toBe('consent-required')
  })

  it('训练和校准结果独立保留质量字段', () => {
    const model = createExperimentModel({ dataClass: 'formal', studyVersion: 'v13-1', consentAccepted: true, participantId: 'p1', sessionId: 's1' })
    expect(model.startTraining().stage).toBe('training')
    expect(model.completeCalibration(false)).toMatchObject({
      trainingStarted: true,
      trainingCompleted: true,
      calibrationPassed: false,
      calibrationAttempts: 1,
      qualityFlags: ['calibration-failed']
    })
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
