import { describe, it, expect } from 'vitest'
import {
  TOP_LEVEL_PAGES,
  EXPERIMENT_TABS,
  createAppState,
  navigate,
  selectLearningTab,
  selectExperimentTab,
  setTeachingLocation,
  beginFormalExperiment,
  acceptConsent,
  saveParticipantProfile,
  completeTraining,
  completeRecognition,
  completeReader
} from '../src/app-state.js'

describe('v9 app state', () => {
  it('默认进入首页并使用五个顶层入口', () => {
    const state = createAppState()
    expect(TOP_LEVEL_PAGES).toEqual(['home', 'learning', 'experiment', 'reader', 'notes'])
    expect(state.page).toBe('home')
    expect(state.learningTab).toBe('teaching')
    expect(state.experimentTab).toBe('recognition')
    expect(EXPERIMENT_TABS).toEqual(['recognition'])
  })

  it('导航只接受有效页面', () => {
    expect(navigate(createAppState(), 'learning').page).toBe('learning')
    expect(navigate(createAppState(), 'reader').page).toBe('reader')
  })

  it('AudioBraille 实验只保留听觉辨识，正式听书不作为实验标签出现', () => {
    const state = navigate(createAppState(), 'experiment')
    expect(selectExperimentTab(state, 'reader')).toEqual(state)
    expect(selectExperimentTab(state, 'recognition')).toMatchObject({ page: 'experiment', experimentTab: 'recognition' })
    expect(selectLearningTab(state, 'input')).toMatchObject({
      page: 'experiment', experimentTab: 'recognition', learningTab: 'input'
    })
  })
  it('正式实验必须按 consent → profile → training → recognition → reader → complete 前进', () => {
    const initial = createAppState()
    const consent = beginFormalExperiment(initial)
    expect(consent.experiment.formalPhase).toBe('consent')
    const profile = acceptConsent(consent)
    expect(profile.experiment.formalPhase).toBe('profile')
    const training = saveParticipantProfile(profile, { visionStatus: 'sighted' })
    expect(training.experiment.formalPhase).toBe('training')
    const recognition = completeTraining(training, { passed: true })
    expect(recognition.experiment.formalPhase).toBe('recognition')
    const reader = completeRecognition(recognition)
    expect(reader.experiment.formalPhase).toBe('reader')
    expect(completeReader(reader).experiment.formalPhase).toBe('complete')
    expect(completeReader(reader, 4).experiment.formalPhase).toBe('reader')
  })

  it('默认没有进入正式实验，正式阶段从同意开始', () => {
    const state = createAppState()
    expect(state.experiment.researchMode).toBe('casual')
    expect(state.experiment.formalPhase).toBe(null)
  })

  it('教学位置可以逐层更新', () => {
    const state = createAppState()
    const next = setTeachingLocation(state, {
      category: 'latin', section: 'l1', item: 'f', phase: 'learn'
    })
    expect(next.teaching).toEqual({ category: 'latin', section: 'l1', item: 'f', phase: 'learn', tone: null, examReferenceVisible: false })
    expect(state.teaching).toEqual({ category: null, section: null, item: null, phase: 'learn', tone: null, examReferenceVisible: false })
  })

  it('考试教学位置默认隐藏参考答案', () => {
    const next = setTeachingLocation(createAppState(), {
      category: 'latin', section: 'l1', item: 'f', phase: 'exam'
    })
    expect(next.teaching.examReferenceVisible).toBe(false)
  })
  it('教学状态保存音节声调选择', () => {
    const next = setTeachingLocation(createAppState(), {
      category: 'pinyin', section: 'syllables', item: 'ba', phase: 'learn', tone: '1'
    })
    expect(next.teaching.tone).toBe('1')
  })
})

  it('正式训练失败时停留在 training，四种辨识模式全部完成后才进入 reader', () => {
    const started = beginFormalExperiment(createAppState(), {
      participantId: 'participant-1',
      sessionId: 'session-1'
    })
    const consented = acceptConsent(started)
    const profile = saveParticipantProfile(consented, {
      visionStatus: 'sighted',
      brailleExperience: 'none',
      audioEncodingExperience: 'none'
    })
    const failed = completeTraining(profile, { passed: false })
    expect(failed.experiment.formalPhase).toBe('training')
    expect(failed.experiment.trainingCompleted).toBe(false)
    const passed = completeTraining(profile, { passed: true })
    expect(passed.experiment.formalPhase).toBe('recognition')
    expect(completeRecognition(passed, ['letters', 'syllables', 'symbols']).experiment.formalPhase).toBe('recognition')
    expect(completeRecognition(passed, ['digits', 'symbols', 'syllables', 'letters']).experiment.formalPhase).toBe('recognition')
    expect(completeRecognition(passed, ['letters', 'syllables', 'symbols', 'digits']).experiment.formalPhase).toBe('reader')
  })

  it('正式实验开始状态保留匿名参与者和会话 ID', () => {
    const state = beginFormalExperiment(createAppState(), {
      participantId: 'participant-1',
      sessionId: 'session-1'
    })
    expect(state.experiment).toMatchObject({
      researchMode: 'formal',
      formalPhase: 'consent',
      participantId: 'participant-1',
      sessionId: 'session-1',
      consentAccepted: false
    })
  })

describe('formal 状态不变量', () => {
  it('重新开始正式实验会清除旧训练和质量状态', () => {
    const state = createAppState()
    const started = beginFormalExperiment(state, { participantId: 'p-1', sessionId: 's-1' })
    const dirty = {
      ...started,
      experiment: {
        ...started.experiment,
        profile: { visionStatus: 'blind' },
        trainingStarted: true,
        trainingCompleted: true,
        calibrationPassed: true,
        calibrationAttempts: 4,
        qualityFlags: ['calibration-failed']
      }
    }
    const restarted = beginFormalExperiment(dirty, { participantId: 'p-2', sessionId: 's-2' })
    expect(restarted.experiment).toMatchObject({
      participantId: 'p-2', sessionId: 's-2', profile: null,
      trainingStarted: false, trainingCompleted: false,
      calibrationPassed: null, calibrationAttempts: 0, qualityFlags: []
    })
  })
})
