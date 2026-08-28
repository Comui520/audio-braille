// src/app-state.js —— v9：单一应用状态与纯更新函数
export const TOP_LEVEL_PAGES = ['home', 'learning', 'experiment', 'notes']
export const LEARNING_TABS = ['teaching', 'input']
export const EXPERIMENT_TABS = ['recognition', 'reader']

export function createAppState() {
  return {
    page: 'home',
    learningTab: 'teaching',
    experimentTab: 'recognition',
    teaching: { category: null, section: null, item: null, phase: 'learn', tone: null },
    input: { confirmedCells: [], currentDots: [], cursorIndex: 0 },
    experiment: { mode: 'letters', stage: 'idle', trials: [], index: 0 },
    audioUnlocked: false
  }
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
    tone: location.tone ?? null
  }
  return { ...state, teaching: next }
}

export function setAudioUnlocked(state, unlocked = true) {
  return { ...state, audioUnlocked: Boolean(unlocked) }
}
