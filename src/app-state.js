// src/app-state.js —— v13：单一应用状态与纯更新函数
export const TOP_LEVEL_PAGES = ['home', 'learning', 'experiment', 'notes']
export const LEARNING_TABS = ['teaching', 'input']
export const EXPERIMENT_TABS = ['recognition', 'reader']
export const FORMAL_RECOGNITION_MODES = ['letters', 'syllables', 'symbols', 'digits']

export function createAppState() {
  return {
    page: 'home',
    learningTab: 'teaching',
    experimentTab: 'recognition',
    teaching: { category: null, section: null, item: null, phase: 'learn', tone: null, examReferenceVisible: false },
    input: { confirmedCells: [], currentDots: [], cursorIndex: 0 },
    experiment: {
      mode: 'letters', stage: 'idle', trials: [], index: 0, results: [],
      researchMode: 'casual', formalPhase: null,
      participantId: null, sessionId: null, profile: null,
      consentAccepted: false, trainingStarted: false, trainingCompleted: false,
      calibrationPassed: null, calibrationAttempts: 0, qualityFlags: [],
      formalRecognitionModesCompleted: [], formalReaderCompleted: 0,
      uploadStatus: 'idle'
    },
    audioUnlocked: false
  }
}

export const FORMAL_PHASE_ORDER = ['consent', 'profile', 'training', 'recognition', 'reader', 'complete']

export function beginFormalExperiment(state, { participantId = null, sessionId = null } = {}) {
  return {
    ...state,
    experiment: {
      ...state.experiment,
      researchMode: 'formal',
      formalPhase: 'consent',
      participantId,
      sessionId,
      profile: null,
      consentAccepted: false,
      trainingStarted: false,
      trainingCompleted: false,
      calibrationPassed: null,
      calibrationAttempts: 0,
      qualityFlags: [],
      formalRecognitionModesCompleted: [],
      formalReaderCompleted: 0,
      uploadStatus: 'idle'
    }
  }
}

export function acceptConsent(state) {
  if (state.experiment.formalPhase !== 'consent') return state
  return { ...state, experiment: { ...state.experiment, formalPhase: 'profile', consentAccepted: true } }
}

export function saveParticipantProfile(state, profile) {
  if (state.experiment.formalPhase !== 'profile') return state
  return { ...state, experiment: { ...state.experiment, formalPhase: 'training', profile, trainingStarted: true } }
}

export function completeTraining(state, { passed = false } = {}) {
  if (state.experiment.formalPhase !== 'training') return state
  const calibrationAttempts = (state.experiment.calibrationAttempts || 0) + 1
  const qualityFlags = passed
    ? state.experiment.qualityFlags
    : [...new Set([...state.experiment.qualityFlags, 'calibration-failed'])]
  return {
    ...state,
    experiment: {
      ...state.experiment,
      formalPhase: passed ? 'recognition' : 'training',
      trainingCompleted: Boolean(passed),
      calibrationPassed: Boolean(passed),
      calibrationAttempts,
      qualityFlags
    }
  }
}

export function completeRecognition(state, completedModes = FORMAL_RECOGNITION_MODES) {
  if (state.experiment.formalPhase !== 'recognition') return state
  const modes = Array.isArray(completedModes) ? [...completedModes] : [...FORMAL_RECOGNITION_MODES]
  const validPrefix = modes.length <= FORMAL_RECOGNITION_MODES.length
    && modes.every((mode, index) => mode === FORMAL_RECOGNITION_MODES[index])
  if (!validPrefix) return state
  const complete = modes.length === FORMAL_RECOGNITION_MODES.length
  return {
    ...state,
    experiment: {
      ...state.experiment,
      formalPhase: complete ? 'reader' : 'recognition',
      formalRecognitionModesCompleted: modes
    }
  }
}

export function completeReader(state, completedCount = 3) {
  if (state.experiment.formalPhase !== 'reader' || completedCount !== 3) return state
  return { ...state, experiment: { ...state.experiment, formalPhase: 'complete', formalReaderCompleted: completedCount } }
}

export function setExperimentUploadStatus(state, uploadStatus) {
  if (!['idle', 'pending', 'success', 'error'].includes(uploadStatus)) return state
  return { ...state, experiment: { ...state.experiment, uploadStatus } }
}

export function navigate(state, page) {
  if (!TOP_LEVEL_PAGES.includes(page)) return state
  return { ...state, page }
}

export function selectLearningTab(state, tab) {
  if (!LEARNING_TABS.includes(tab)) return state
  return { ...state, learningTab: tab }
}

export function selectExperimentTab(state, tab) {
  if (!EXPERIMENT_TABS.includes(tab)) return state
  return { ...state, experimentTab: tab }
}

export function setTeachingLocation(state, location) {
  const next = {
    category: location.category ?? null,
    section: location.section ?? null,
    item: location.item ?? null,
    phase: location.phase ?? 'learn',
    tone: location.tone ?? null,
    examReferenceVisible: false
  }
  return { ...state, teaching: next }
}

export function setAudioUnlocked(state, unlocked = true) {
  return { ...state, audioUnlocked: Boolean(unlocked) }
}
