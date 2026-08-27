// src/app.js —— v5：首页三入口 + 六页导航（学习/输入/测试/笔记/听书）
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { initInput } from './input.js'
import { initTeaching } from './teaching.js'
import { initNotes } from './notes.js'
import { initExperiment } from './experiment.js'
import { createReader, SAMPLE_TEXT, clampSpeed } from './reader.js'
import { guideView, buildGuideSpeech, renderQuickGuide } from './guide.js'
import { unlockAudio } from './audio-braille.js'
import { speak } from './speech.js'
import { t, getLang, setLang } from './i18n.js'

// ===== AppState =====
export function createAppState() {
  const state = {
    currentPage: 'home',            // home | teaching | input | experiment | notes | reader
    brailleDots: [false, false, false, false, false, false],
    inputStage: 'initial',
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
  return ['home', 'guide', 'teaching', 'input', 'experiment', 'notes', 'reader']
}

// ===== 视觉主题 =====
const THEMES = {
  hc: { css: '--bg:#0b1220;--bg-soft:#0f172a;--fg:#e2e8f0;--accent:#38bdf8;--accent-2:#818cf8;--card:#1e293b;--border:#334155;--muted:#94a3b8' },
  light: { css: '--bg:#f6f8fb;--bg-soft:#fff;--fg:#1a202c;--accent:#2563eb;--accent-2:#7c3aed;--card:#fff;--border:#e2e8f0;--muted:#64748b' },
  ocean: { css: '--bg:#04121f;--bg-soft:#062438;--fg:#dbeafe;--accent:#22d3ee;--accent-2:#818cf8;--card:#0a2e44;--border:#155e75;--muted:#7dd3fc' }
}
function applyTheme(theme) {
  const th = THEMES[theme] || THEMES.hc
  document.documentElement.style.cssText = th.css
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

  // ===== 首页（三入口卡片）=====
  function homeView() {
    const sec = document.createElement('section')
    sec.className = 'home'
    sec.innerHTML = `
      <h1>${t('homeTitle')}</h1>
      <p class="home-sub">${t('homeSub')}</p>
      ${renderQuickGuide()}
      <div class="home-cards">
        <button class="home-card" data-nav="guide">❓<br>${t('navGuide')}</button>
        <button class="home-card" data-nav="teaching">📖<br>${t('navTeaching')}</button>
        <button class="home-card" data-nav="input">⌨️<br>${t('navInput')}</button>
      </div>
      <div class="home-cards">
        <button class="home-card" data-nav="experiment">🎧<br>${t('navExperiment')}</button>
        <button class="home-card" data-nav="notes">📝<br>${t('navNotes')}</button>
        <button class="home-card" data-nav="reader">📻<br>${t('navReader')}</button>
      </div>`
    return sec
  }

  // ===== 听书页 =====
  let reader = null
  function readerView() {
    reader = reader || createReader()
    const sec = document.createElement('section')
    sec.innerHTML = `
      <h1>${t('readerTitle')}</h1>
      <p class="home-sub">${t('readerSub')}</p>
      <div class="reader-controls">
        <label>${t('readerSpeed')}：<input type="range" id="reader-speed" min="0.5" max="5" step="0.5" value="1" aria-label="${t('readerSpeed')}"></label>
        <span id="reader-speed-val">1x</span>
        <button id="reader-play">${t('readerPlay')}</button>
        <button id="reader-stop">${t('readerStop')}</button>
      </div>
      <div id="reader-progress" aria-live="polite"></div>
      <div class="reader-question">
        <span>${t('readerUnderstand')}</span>
        <button id="reader-yes">${t('readerYes')}</button>
        <button id="reader-no">${t('readerNo')}</button>
      </div>`
    return sec
  }

  function bindReader(container) {
    if (!reader) return
    const speedEl = container.querySelector('#reader-speed')
    const speedVal = container.querySelector('#reader-speed-val')
    const playBtn = container.querySelector('#reader-play')
    const stopBtn = container.querySelector('#reader-stop')
    const progressEl = container.querySelector('#reader-progress')
    speedEl?.addEventListener('input', () => {
      const v = clampSpeed(Number(speedEl.value))
      reader.setSpeed(v)
      speedVal.textContent = `${v}x`
    })
    playBtn?.addEventListener('click', async () => {
      playBtn.disabled = true
      progressEl.textContent = t('readerPlaying')
      await reader.play(SAMPLE_TEXT)
      playBtn.disabled = false
      progressEl.textContent = ''
    })
    stopBtn?.addEventListener('click', () => { reader.stop() })
    container.querySelector('#reader-yes')?.addEventListener('click', () => speak(t('readerYes') + '，' + t('readerThank')))
    container.querySelector('#reader-no')?.addEventListener('click', () => speak(t('readerNo') + '，' + t('readerThank')))
  }

  // ===== 渲染 =====
  function render() {
    // 更新导航文本（响应中英文切换）
    document.querySelectorAll('nav button').forEach(b => {
      const key = b.dataset.i18n
      if (key) b.textContent = t(key)
      b.setAttribute('aria-current', b.dataset.page === state.currentPage ? 'true' : 'false')
    })
    // 更新品牌副标题
    const brandSub = document.getElementById('brand-sub')
    if (brandSub) brandSub.textContent = t('appName')
    dotsEl.setAttribute('aria-label',
      state.brailleDots.map((v, i) => (v ? `点${i + 1}` : '')).filter(Boolean).join('、') || t('dotsEmpty'))
    dotsEl.innerHTML = [...Array(6)].map((_, i) =>
      `<span class="dot ${state.brailleDots[i] ? 'on' : ''}" style="grid-area:d${i + 1}"></span>`
    ).join('')
    // 懒重建视图（语言切换后清缓存，这里按当前语言重建）
    if (!pageViews.teaching) {
      pageViews.teaching = teaching.view()
      teaching.bind(pageViews.teaching)
    }
    if (!pageViews.experiment) {
      pageViews.experiment = experiment.view()
      experiment.bind(pageViews.experiment)
    }
    if (!pageViews.notes) {
      pageViews.notes = notes.view()
    }
    if (!pageViews.reader) {
      pageViews.reader = readerView()
      bindReader(pageViews.reader)
    }
    const view = state.currentPage === 'home' ? homeView()
      : state.currentPage === 'guide' ? guideView()
      : (pageViews[state.currentPage] ?? emptyView())
    main.replaceChildren(dotsEl, view)
    // 输入反馈条
    main.appendChild(input.feedbackEl)
    // 动态绑定
    if (state.currentPage === 'reader') bindReader(main)
    // 语言切换后重建视图文案
    if (state.currentPage === 'notes') notes.updateReference?.()
  }

  // ===== 输入器接线 =====
  const input = initInput({ state, render, settings: state.settings })
  const activeField = () => main.querySelector('textarea')
  input.setInsertHandler(text => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta) {
      const s = ta.selectionStart ?? ta.value.length
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd ?? s)
      ta.focus()
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

  // ===== 教学/笔记/实验/听书接线 =====
  const teaching = initTeaching({ state, render, storage })
  const notes = initNotes({ state, storage, render })
  const experiment = initExperiment({ state, render })
  // 视图由 render 懒重建（语言切换后自动按当前语言重建）
  pageViews.input = emptyView()
  input.setTeachingSubmit((dots) => teaching.handleConfirm(dots))
  input.setExperimentSubmit((dots) => experiment.handleKey0(dots))

  // 页面级按钮：教学阶段/子模块、笔记保存/回放、实验开始
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]')
    if (navBtn) {
      state.currentPage = navBtn.dataset.nav
      input.resetInput()
      render()
      return
    }
    if (e.target.closest('#note-save')) { void notes.save(); return }
    if (e.target.closest('#note-play')) { void notes.playback(); return }
    if (e.target.closest('#note-new')) { notes.newNote(); return }
    if (e.target.closest('#note-export')) { void notes.exportNote('json'); return }
    if (e.target.closest('#note-import')) {
      const fileInput = document.querySelector('#note-import-file')
      fileInput?.click()
      return
    }
    if (e.target.closest('#note-import-file')) {
      const f = e.target.files?.[0]
      if (f) void notes.importNote(f)
      return
    }
    if (e.target.closest('#guide-speak')) { speak(buildGuideSpeech()); return }
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
  const gateGuide = document.getElementById('gate-guide')
  if (gateHint) gateHint.textContent = t('press0Start')
  // 启动门内嵌简要使用说明（首次进入就能看到规则）
  if (gateGuide) {
    gateGuide.innerHTML = `<p class="gate-guide-text">${t('guideIntro')}</p>
      <p class="gate-guide-text"><strong>${t('guideQuickTitle')}</strong>${t('guideQuick')}</p>`
  }

  function unlockApp() {
    audioUnlocked = true
    unlockAudio()
    if (gateEl) gateEl.remove()
    speak(t('welcome'))
    main.focus()
  }

  function gateKey(e) {
    if (audioUnlocked) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === '0') {
      unlockApp()
    } else {
      speak(t('press0Start'))
    }
  }
  window.addEventListener('keydown', gateKey, true)

  // 解锁前点击导航/按钮也拦截
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
    // 重建视图（更新文案）——清缓存，render 时按当前语言重建
    delete pageViews.teaching
    delete pageViews.experiment
    delete pageViews.notes
    delete pageViews.reader
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

  // 历史笔记列表
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

  render()
}