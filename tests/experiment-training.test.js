import { describe, it, expect } from 'vitest'
import {
  CALIBRATION_PASS_SCORE,
  TRAINING_CALIBRATION_TRIALS,
  TRAINING_PRACTICE_TRIALS,
  TRAINING_MULTI_EXAMPLES,
  TRAINING_SINGLE_POINTS,
  buildTrainingPlan,
  createExperimentModel
} from '../src/experiment.js'

describe('正式实验统一训练和校准', () => {
  it('训练计划包含规则、六个单点和多点示例，并按固定顺序推进', () => {
    const plan = buildTrainingPlan()
    expect(plan.steps).toEqual(['rules', 'single-points', 'multi-examples', 'practice', 'calibration'])
    expect(plan.singlePoints).toEqual(TRAINING_SINGLE_POINTS)
    expect(plan.multiExamples).toEqual(TRAINING_MULTI_EXAMPLES)
    expect(plan.singlePoints).toHaveLength(6)
    expect(plan.multiExamples.length).toBeGreaterThan(0)

    const model = createExperimentModel({ dataClass: 'formal', consentAccepted: true, participantId: 'p1', sessionId: 's1' })
    expect(model.startTraining().trainingStep).toBe('rules')
    expect(model.advanceTrainingStep().trainingStep).toBe('single-points')
    expect(model.advanceTrainingStep().trainingStep).toBe('multi-examples')
    expect(model.advanceTrainingStep().trainingStep).toBe('practice')
  })

  it('练习和校准题必须先播放，校准按固定答案自动判定', () => {
    const model = createExperimentModel({ dataClass: 'formal', consentAccepted: true, participantId: 'p1', sessionId: 's1' })
    model.startTraining()
    model.advanceTrainingStep()
    model.advanceTrainingStep()
    model.advanceTrainingStep()

    expect(model.submitTrainingAnswer(TRAINING_CALIBRATION_TRIALS[0].cells).reason).toBe('training-question-not-played')
    model.startTrainingQuestion()
    const practice = model.submitTrainingAnswer(model.snapshot().trainingPracticeTrials[0].cells)
    expect(practice.correct).toBe(true)

    // 完成剩余练习题，进入校准；校准题仍需逐题播放。
    while (model.snapshot().trainingStep === 'practice') {
      model.startTrainingQuestion()
      const current = model.snapshot().trainingPracticeTrials[model.snapshot().trainingQuestionIndex]
      model.submitTrainingAnswer(current.cells)
    }
    expect(model.snapshot().trainingStep).toBe('calibration')
    expect(model.submitTrainingAnswer(TRAINING_CALIBRATION_TRIALS[0].cells).reason).toBe('training-question-not-played')

    for (const trial of TRAINING_CALIBRATION_TRIALS) {
      model.startTrainingQuestion()
      const result = model.submitTrainingAnswer(trial.cells)
      if (trial !== TRAINING_CALIBRATION_TRIALS.at(-1)) expect(result.finished).toBe(false)
    }
    expect(model.snapshot()).toMatchObject({
      stage: 'idle', trainingCompleted: true, calibrationPassed: true,
      calibrationAttempts: 1
    })
    expect(model.snapshot().trainingCalibrationScore).toBeGreaterThanOrEqual(CALIBRATION_PASS_SCORE)
  })

  it('训练提交返回可保存的 training trial 记录，而不是正式结果记录', () => {
    const model = createExperimentModel({
      dataClass: 'formal',
      studyVersion: 'v13-2',
      participantId: 'p1',
      sessionId: 's1'
    })
    model.startTraining()
    model.advanceTrainingStep()
    model.advanceTrainingStep()
    model.advanceTrainingStep()
    model.startTrainingQuestion()

    const result = model.submitTrainingAnswer(TRAINING_PRACTICE_TRIALS[0].cells)

    expect(result.record).toMatchObject({
      trialId: expect.stringContaining('s1:training:practice:0:'),
      stimulusId: 'training:practice:practice-1',
      mode: 'practice',
      phase: 'training',
      dataClass: 'training',
      studyVersion: 'v13-2',
      trialIndex: 0,
      responseCells: [[1]],
      expectedCellsHash: expect.stringMatching(/^fnv1a-/),
      correct: true
    })
    expect(result.record.reactionTimeMs).toBeGreaterThanOrEqual(0)
  })
})