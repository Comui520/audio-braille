// src/app.js —— v2：三模块独立（教学/输入+笔记/听觉实验）+ 语言切换 + 视觉美化
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { initInput } from './input.js'
import { initTeaching } from './teaching.js'
import { initNotes } from './notes.js'
import { initExperiment } from './experiment.js'
import { unlockAudio } from './audio-braille.js'
import { speak } from './speech.js'
import { t, getLang, setLang } from './i18n.js'

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
    }
  }
  return state
}

export function buildPages() {
  return ['teaching', 'input', 'experiment', 'notes']
}

// ===== 视觉主题 =====
const THEMES = {
  hc: { name: '高对比', css: '--bg:#0a0a0a;--fg:#ffd700;--accent:#4fc3f7;--card:#1a1a1a;--border:#333' },
  light: { name: '明亮', css: '--bg:#fafafa;--fg:#1a1a1a;--accent:#1565c0;--card:#fff;--border:#ddd' },
  ocean: { name: '海洋', css: '--bg:#0d2137;--fg:#e0f2fe;--accent:#4fc3f7;--card:#13324f;--border:#1e4a6d' }
}
function applyTheme(theme) {
  const t = THEMES[theme] || THEMES.hc
  document.documentElement.style.cssText = t.css
  document.documentElement.dataset.theme = theme
}

export function initApp() {
  const state = createAppState()
  const storage = createStorage()
  storage.init().then(() => {
    const saved = loadSettings()
    if (saved) Object.assign(state.settings, saved)
    applyTheme(state.settings.theme)
  })

  const main = document.getElementById('main-content')
  const dotsEl = Object.assign(document.createElement('div'), { id: 'dots' })
  dotsEl.setAttribute('role', 'img')

  // 页面视图注册表
  const pageViews = {}
  const emptyView = () => Object.assign(document.createElement('section'), { textContent: t('empty') })

  // 启动门状态（必须先按 0 解锁音频与语音）
  let audioUnlocked = false

  // ===== 渲染 =====
  function render() {
    document.querySelectorAll('nav button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.page === state.currentPage ? 'true' : 'false')
    })
    dotsEl.setAttribute('aria-label',
      state.brailleDots.map((v, i) => (v ? `点${i + 1}` : '')).filter(Boolean).join('、') || t('dotsEmpty'))
    dotsEl.innerHTML = [...Array(6)].map((_, i) =>
      `<span class="dot ${state.brailleDots[i] ? 'on' : ''}" style="grid-area:d${i + 1}"></span>`
    ).join('')
    main.replaceChildren(dotsEl, pageViews[state.currentPage] ?? emptyView())
    // 输入反馈条（按点位键实时显示 组合→字母）
    main.appendChild(input.feedbackEl)
    // 语言切换后重建视图文案
    if (state.currentPage === 'notes') notes.updateReference?.()
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
      // 明文对照更新（notes API 对象，不是 DOM 视图）
      notes.updateReference?.()
    }
  })
  input.setBackspaceHandler(() => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta && ta.selectionStart > 0) {
      ta.value = ta.value.slice(0, ta.selectionStart - 1) + ta.value.slice(ta.selectionEnd)
      ta.focus()
      notes.updateReference?.()
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
  teaching.bind(pageViews.teaching)
  experiment.bind(pageViews.experiment)
  input.setTeachingSubmit((dots) => teaching.handleConfirm(dots))
  // 实验：按 0 统一入口（听音频/提交猜测，见 experiment.handleKey0）
  input.setExperimentSubmit((dots) => experiment.handleKey0(dots))

  // 页面级按钮：教学阶段切换、笔记保存/回放、实验开始
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]')
    if (btn) {
      const mode = btn.dataset.mode
      void teaching.init(mode)   // teaching.js 内部会出题并播报
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

  // 启动门：全屏遮罩 + 键拦截，按 0 前无法进入/操作
  const gateEl = document.getElementById('start-gate')
  const gateHint = document.getElementById('gate-hint')
  if (gateHint) gateHint.textContent = t('press0Start')

  function unlockApp() {
    audioUnlocked = true
    unlockAudio()
    if (gateEl) gateEl.remove()
    speak(t('welcome'))
    main.focus()
  }

  function gateKey(e) {
    if (audioUnlocked) return
    if (e.key === '0') {
      unlockApp()
    } else {
      e.preventDefault()
      e.stopPropagation()
      speak(t('press0Start'))
    }
  }
  window.addEventListener('keydown', gateKey, true)   // capture 阶段拦截一切

  // 解锁前点击导航/按钮也拦截（遮罩已挡住，但保险起见）
  document.addEventListener('click', (e) => {
    if (audioUnlocked) return
    if (e.target.closest('#start-gate')) {
      unlockApp()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }, true)

  const langBtn = document.getElementById('lang-toggle')
  if (langBtn) {
    langBtn.addEventListener('click', () => toggleLang())
  }

  function toggleLang() {
    const next = getLang() === 'en' ? 'zh' : 'en'
    setLang(next)
    speak(t('langChanged') + ' ' + (next === 'en' ? 'English' : '中文'))
    // 重建当前页视图（更新文案）
    pageViews.teaching = teaching.view()
    pageViews.experiment = experiment.view()
    pageViews.notes = notes.view()
    teaching.bind(pageViews.teaching)
    experiment.bind(pageViews.experiment)
    render()
  }

  // 全局快捷键
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault()
      speak(t('help'))
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      state.settings.silentMode = !state.settings.silentMode
      saveSettings(state.settings)
      speak(state.settings.silentMode ? t('silentOn') : t('silentOff'))
    }
    // 语言切换：Ctrl+Shift+L
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      toggleLang()
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
    if (list.length === 0) { speak(t('notesNoHistory')); return }
    const panel = Object.assign(document.createElement('div'), { id: 'history-panel' })
    panel.setAttribute('role', 'listbox')
    panel.setAttribute('aria-label', t('notesTitle'))
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
        speak(t('notesOpened') + ' ' + options[idx].textContent)
      }
      else if (ev.key === 'Escape') { close() }
    }
    panel.addEventListener('keydown', onKey)
    options[0]?.addEventListener('click', () => { close(); void notes.open(options[0].dataset.id) })
  }

  main.focus()
  speak(t('welcome'))
  render()
}
