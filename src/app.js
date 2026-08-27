// src/app.js —— 骨架部分（其余模块任务中逐步接入）
import { speak } from './speech.js'

export function createAppState() {
  const state = {
    currentPage: 'teaching',            // teaching | input | experiment | notes
    brailleDots: [false, false, false, false, false, false],
    inputStage: 'initial',              // initial | final | tone | commit
    learningProgress: { level: 1, records: {} },
    notes: [],
    settings: { clickSound: true, silentMode: false, theme: 'hc', fontSize: 20 },
    setDots(index) {
      state.brailleDots = state.brailleDots.map((v, i) => (i === index ? !v : v))
      return state.brailleDots
    },
    clearDots() {
      state.brailleDots = [false, false, false, false, false, false]
      state.inputStage = 'initial'
    }
  }
  return state
}

export function initApp() {
  const state = createAppState()
  // 首次键盘敲击解锁 Web Audio（任务 4 提供 unlockAudio）
  const unlock = () => { window.removeEventListener('keydown', unlock); import('./audio-braille.js').then(m => m.unlockAudio()) }
  window.addEventListener('keydown', unlock)
  // 导航骨架（模块任务中填充分发）
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      state.settings.silentMode = !state.settings.silentMode
      speak(state.settings.silentMode ? '静音模式已开启' : '静音模式已关闭')
    }
    if (e.key === 'F1') { e.preventDefault(); speak('按 0 确认。按 3 退格。按 7 4 1 8 5 2 输入点位。') }
  })
  // 页面加载自动聚焦主内容并播报欢迎（任务 7 接入教学后完善）
  const main = document.getElementById('main-content')
  main?.focus()
  speak('欢迎来到 AudioBraille 盲文学习平台')
}
