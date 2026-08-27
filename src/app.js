// src/app.js —— 完整版（任务 10：模块整合与无障碍收尾）
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { initInput } from './input.js'
import { initTeaching } from './teaching.js'
import { initNotes } from './notes.js'
import { initExperiment } from './experiment.js'
import { unlockAudio } from './audio-braille.js'
import { speak } from './speech.js'

// ===== AppState =====
export function createAppState() {
  const state = {
    currentPage: 'teaching',            // teaching | input | experiment | notes
    brailleDots: [false, false, false, false, false, false],
    inputStage: 'initial',              // initial | final | tone | commit
    learningProgress: { level: 1, records: {} },
    notes: [],
    settings: { clickSound: true, silentMode: false, theme: 'hc', fontSize: 20, toneMode: true },
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

export function buildPages() {
  return ['teaching', 'input', 'experiment', 'notes']
}

export function initApp() {
  const state = createAppState()
  const storage = createStorage()
  storage.init().then(() => {
    const saved = loadSettings()
    if (saved) Object.assign(state.settings, saved)
  })

  const main = document.getElementById('main-content')
  const dotsEl = Object.assign(document.createElement('div'), { id: 'dots' })
  dotsEl.setAttribute('role', 'img')

  // 页面视图注册表
  const pageViews = {}
  const emptyView = () => Object.assign(document.createElement('section'), { textContent: '请选择模块' })

  // ===== 渲染 =====
  function render() {
    document.querySelectorAll('nav button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.page === state.currentPage ? 'true' : 'false')
    })
    dotsEl.setAttribute('aria-label',
      state.brailleDots.map((v, i) => (v ? `点${i + 1}` : '')).filter(Boolean).join('、') || '空')
    dotsEl.innerHTML = [...Array(6)].map((_, i) =>
      `<span class="dot ${state.brailleDots[i] ? 'on' : ''}" style="grid-area:d${i + 1}"></span>`
    ).join('')
    main.replaceChildren(dotsEl, pageViews[state.currentPage] ?? emptyView())
  }

  // ===== 输入器接线 =====
  const input = initInput({ state, render, settings: state.settings })
  const activeField = () => pageViews[state.currentPage]?.querySelector('textarea') ?? main
  input.setInsertHandler(text => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta) {
      const s = ta.selectionStart ?? ta.value.length
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd ?? s)
      ta.focus()
    }
  })
  input.setBackspaceHandler(() => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta && ta.selectionStart > 0) {
      ta.value = ta.value.slice(0, ta.selectionStart - 1) + ta.value.slice(ta.selectionEnd)
      ta.focus()
    }
  })

  // ===== 教学/笔记/实验接线 =====
  const teaching = initTeaching({ state, render, storage })
  const notes = initNotes({ state, storage, render })
  const experiment = initExperiment({ state, render })
  pageViews.teaching = teaching.view()
  pageViews.input = emptyView()
  pageViews.experiment = experiment.view()
  pageViews.notes = notes.view()

  // 页面级按钮：教学模式切换、笔记保存/回放、实验开始
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]')
    if (btn) {
      const mode = btn.dataset.mode
      state.teachingMode = mode
      const lesson = document.querySelector('#lesson')
      if (lesson) lesson.textContent = `已进入${mode === 'explore' ? '探索' : '考试'}模式（TTS 出题，小键盘作答）`
      speak(mode === 'explore' ? '探索模式' : '考试模式')
      return
    }
    if (e.target.closest('#note-save')) { void notes.save(); return }
    if (e.target.closest('#note-play')) { void notes.playback(); return }
    if (e.target.closest('[data-exp="start"]')) { experiment.start(); return }
  })

  // 导航切换（键盘 Tab + Enter 原生支持 button）
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = btn.dataset.page
      input.resetInput()
      render()
    })
  })

  // 首次键盘解锁音频
  const unlockOnce = () => {
    window.removeEventListener('keydown', unlockOnce)
    unlockAudio()
    speak('音频引擎已就绪')
  }
  window.addEventListener('keydown', unlockOnce)

  // 全局快捷键
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault()
      speak('按 0 确认送字。按 3 退格。按减号清空。按加号朗读。按句号空格。F1 帮助。Ctrl 加 Shift 加 M 静音。')
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      state.settings.silentMode = !state.settings.silentMode
      saveSettings(state.settings)
      speak(state.settings.silentMode ? '静音模式开启' : '静音模式关闭')
    }
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (state.currentPage === 'notes') void notes.save()
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault()
      if (state.currentPage === 'notes') void openHistory()
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      if (state.currentPage === 'notes') notes.newNote()
    }
  })

  // 历史笔记列表（Ctrl+O：上下键选择，Enter 打开）
  async function openHistory() {
    const list = await notes.list()
    if (list.length === 0) { speak('没有历史笔记'); return }
    const panel = Object.assign(document.createElement('div'), { id: 'history-panel' })
    panel.setAttribute('role', 'listbox')
    panel.setAttribute('aria-label', '历史笔记')
    panel.innerHTML = list.map((n, i) =>
      `<div role="option" tabindex="-1" data-id="${n.id}" data-idx="${i}">${n.title} — ${(n.plain || '').slice(0, 20)}</div>`
    ).join('')
    main.appendChild(panel)
    let idx = 0
    const options = panel.querySelectorAll('[role="option"]')
    const highlight = (i) => {
      options.forEach((o, j) => { o.setAttribute('aria-selected', j === i ? 'true' : 'false') })
      options[i]?.focus()
    }
    highlight(0)
    const close = () => panel.remove()
    const onKey = (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); idx = (idx + 1) % options.length; highlight(idx) }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); idx = (idx - 1 + options.length) % options.length; highlight(idx) }
      else if (ev.key === 'Enter') {
        ev.preventDefault(); close()
        void notes.open(options[idx].dataset.id)
        speak('已打开' + options[idx].textContent)
      }
      else if (ev.key === 'Escape') { close() }
    }
    panel.addEventListener('keydown', onKey)
    options[0]?.addEventListener('click', () => { close(); void notes.open(options[0].dataset.id) })
  }

  main.focus()
  speak('欢迎来到 AudioBraille 盲文学习平台')
  render()
}
