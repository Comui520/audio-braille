// src/app.js —— v9：单一应用壳、四入口、统一事件路由
import './styles.css'
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { createAppState, TOP_LEVEL_PAGES } from './app-state.js'
import { createInputController, keyToPoint } from './input.js'
import { createProgressStore } from './curriculum.js'
import { getTeachingCategories, getTeachingSections, getTeachingItems, getTeachingItem, markTeachingLearned, buildItemSpeech } from './teaching.js'
import { buildTeachingSpeech } from './teaching-speech.js'
import { createExperimentModel, buildShowcase } from './experiment.js'
import { createReader, SAMPLE_TEXT } from './reader.js'
import { initNotes } from './notes.js'
import { playAudioBraille, buildCellSequence, unlockAudio } from './audio-braille.js'
import { speak, cancelSpeech } from './speech.js'
import { getLang, setLang, t } from './i18n.js'
import { toCells, cellsToUnicode, cellsToDiagram, keyHintForCells } from './cells.js'

export { createAppState }
export function buildPages() { return [...TOP_LEVEL_PAGES] }

export function buildTopNav(lang = 'zh') {
  return [
    { id: 'home', label: lang === 'en' ? 'Home' : '首页' },
    { id: 'learning', label: lang === 'en' ? 'Learn Braille' : '学习盲文' },
    { id: 'experiment', label: lang === 'en' ? 'AudioBraille Lab' : 'AudioBraille 实验' },
    { id: 'notes', label: lang === 'en' ? 'Notes' : '笔记' }
  ]
}

export function buildHomeActions() {
  return [
    { action: 'learning', icon: '学', label: '学习盲文' },
    { action: 'experiment', icon: '听', label: 'AudioBraille 实验' },
    { action: 'notes', icon: '记', label: '笔记' },
    { action: 'guide', icon: '?', label: '使用说明' }
  ]
}

const THEME = {
  light: '--page:#f6f7f9;--surface:#fff;--surface-muted:#f0f2f5;--text:#20242a;--text-muted:#5f6875;--line:#d9dee6;--brand:#2457c5;--brand-hover:#19469f;--success:#177245;--danger:#b42318;--focus:#173f8a'
}

function applyTheme() {
  document.documentElement.style.cssText = THEME.light
  document.documentElement.dataset.theme = 'light'
}

function esc(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

function pointsText(cells) {
  return cells.map(cell => cell.map(dot => `点${dot}`).join('、')).join('；')
}

function diagramHtml(cells) {
  return `<span class="braille-diagram" aria-label="盲文 ${esc(cellsToUnicode(cells))}">${cellsToDiagram(cells).map(cell => {
    const order = [0, 3, 1, 4, 2, 5]
    return `<span class="braille-cell">${order.map(index => `<i class="braille-dot${cell.dots[index] ? ' is-on' : ''}"></i>`).join('')}</span>`
  }).join('')}</span>`
}

export function initApp() {
  applyTheme()
  let state = createAppState()
  const storage = createStorage()
  const progress = createProgressStore(storage)
  const notes = initNotes({ state, storage, render })
  const reader = createReader({ onTick: (position, total) => {
    const el = document.querySelector('#reader-progress')
    if (el) el.textContent = `${position} / ${total}`
  } })
  const experiment = createExperimentModel({ trialCount: 10 })
  let noteText = ''
  let inputOutput = ''
  let progressCache = {}
  let currentReaderText = SAMPLE_TEXT
  let experimentToken = 0
  let gateOpen = false

  const main = document.querySelector('#main-content')
  if (!main) return

  storage.init().then(async () => {
    const saved = loadSettings()
    if (saved) Object.assign(state.settings || {}, saved)
    const savedProgress = await storage.loadProgress()
    progressCache = savedProgress?.version === 2 ? (savedProgress.sections || {}) : {}
    render()
  }).catch(() => render())

  function sectionProgress(category, section) {
    return progressCache[`${category}.${section}`] || { learned: [], current: null }
  }

  function saveSectionProgress(category, section, value) {
    progressCache[`${category}.${section}`] = value
  }

  function renderHome() {
    return `<section class="page page-home">
      <div class="hero-copy">
        <p class="eyebrow">AudioBraille</p>
        <h1>${t('homeTitle')}</h1>
        <p class="lead">学习盲文，体验一种用空间音频聆听盲文的新方法。</p>
      </div>
      <details class="guide-fold">
        <summary>第一次使用？查看操作说明</summary>
        <div class="guide-fold-body">
          <p>小键盘 7、4、1 对应点 1、2、3；8、5、2 对应点 4、5、6。</p>
          <p><kbd>0</kbd> 提交　<kbd>*</kbd> 下一方　<kbd>/</kbd> 上一方　<kbd>3</kbd> 退格　<kbd>-</kbd> 清空　<kbd>+</kbd> 朗读　<kbd>.</kbd> 空格</p>
          <button class="button button-quiet" data-action="speak-guide">朗读说明</button>
        </div>
      </details>
      <div class="home-actions">${buildHomeActions().map(item => `<button class="home-action" data-action="${item.action}"><span class="action-icon">${item.icon}</span><span>${item.label}</span><small>${item.action === 'experiment' ? '听觉辨识与听书场景' : item.action === 'learning' ? '从字母、拼音到数字和符号' : item.action === 'notes' ? '记录、导入、导出与朗读' : '键位和基本操作'}</small></button>`).join('')}</div>
    </section>`
  }

  function renderLearning() {
    const tab = state.learningTab
    return `<section class="page page-learning">
      <div class="page-heading"><div><p class="eyebrow">LEARNING</p><h1>学习盲文</h1></div></div>
      <div class="tabs" role="tablist">
        <button class="tab${tab === 'teaching' ? ' is-active' : ''}" data-action="learning-tab" data-tab="teaching">教学</button>
        <button class="tab${tab === 'input' ? ' is-active' : ''}" data-action="learning-tab" data-tab="input">在线输入</button>
      </div>
      ${tab === 'teaching' ? renderTeaching() : renderInput()}
    </section>`
  }

  function renderTeaching() {
    const teaching = state.teaching
    if (!teaching.category) {
      return `<div class="section-intro"><h2>选择学习内容</h2><p>四个区域彼此独立。你可以从任何区域、任何细项开始。</p></div><div class="category-grid">${getTeachingCategories(getLang()).map(item => `<button class="category-card" data-action="teaching-category" data-category="${item.id}"><b>${item.icon}</b><strong>${esc(item.label)}</strong><span>自由选择细项和项目</span></button>`).join('')}</div>`
    }
    if (!teaching.section) {
      const category = getTeachingCategories(getLang()).find(item => item.id === teaching.category)
      return `<div class="subhead"><button class="button button-quiet" data-action="teaching-home">← 教学区域</button><h2>${esc(category?.label || '')}</h2></div><div class="section-list">${getTeachingSections(teaching.category, getLang()).map(section => {
        const p = sectionProgress(teaching.category, section.id)
        return `<article class="learning-section"><div class="section-title"><div><h3>${esc(section.label)}</h3><span>${p.learned.length} / ${section.items.length} 已学</span></div><button class="button button-small" data-action="teaching-continue" data-section="${section.id}">${p.current || section.items[0] ? '继续学习' : '查看'}</button></div><div class="progress-track"><i style="width:${Math.round(p.learned.length / section.items.length * 100)}%"></i></div><div class="item-picker">${getTeachingItems(teaching.category, section.id, p).map(item => `<button class="item-chip${item.learned ? ' is-learned' : ''}${item.current ? ' is-current' : ''}" data-action="teaching-item" data-section="${section.id}" data-item="${encodeURIComponent(item.itemId || item.label)}">${esc(item.label)}${item.learned ? ' ✓' : ''}</button>`).join('')}</div></article>`
      }).join('')}</div>`
    }
    return renderTeachingItem()
  }

  function renderTeachingItem() {
    const teaching = state.teaching
    const item = getTeachingItem(teaching.category, teaching.section, teaching.item, getLang())
    if (!item) return `<div class="empty-state">找不到这个学习项目<button class="button" data-action="teaching-back-section">返回</button></div>`
    const section = getTeachingSections(teaching.category, getLang()).find(value => value.id === teaching.section)
    const items = section?.items || []
    const index = items.indexOf(teaching.item)
    const practice = teaching.phase !== 'learn'
    return `<div class="subhead"><button class="button button-quiet" data-action="teaching-back-section">← ${esc(section?.label || '列表')}</button><span class="item-position">${index + 1} / ${items.length}</span></div>
      <div class="lesson-layout">
        <div class="lesson-summary"><p class="eyebrow">${esc(item.type)}</p><h2>${esc(item.label)}</h2><p class="lesson-note">${item.type === 'initial' ? '声母' : item.type === 'final' ? '韵母' : item.type === 'syllable' ? `音节${item.toneName ? ` · ${item.toneName}` : ''}` : ''}</p></div>
        <div class="lesson-braille"><div class="lesson-unicode">${esc(item.unicode)}</div>${diagramHtml(item.cells)}<p>点位：${esc(pointsText(item.cells))}</p><p>键位：<strong>${esc(keyHintForCells(item.cells))}</strong></p></div>
        <div class="lesson-actions"><button class="button button-primary" data-action="play-item">播放 AudioBraille</button><button class="button button-success" data-action="mark-learned">标记为已学</button></div>
      </div>
      <div class="phase-tabs"><button class="tab${teaching.phase === 'learn' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="learn">学</button><button class="tab${teaching.phase === 'practice' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="practice">练</button><button class="tab${teaching.phase === 'exam' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="exam">考</button></div>
      <div class="phase-panel">${practice ? `<p>${teaching.phase === 'practice' ? '请根据上方提示输入，按 0 提交。' : '不看答案，输入这个项目的盲文，按 0 提交。'}</p><div class="input-preview" id="learning-input-preview">${state.input.confirmedCells.map(cell => cellsToUnicode([cell])).join('')}${state.input.currentDots.length ? '…' : ''}</div>` : `<p>${esc(buildItemSpeech(item, getLang()))}</p>`}</div>
      <div class="item-nav"><button class="button button-quiet" data-action="teaching-prev" ${index <= 0 ? 'disabled' : ''}>← 上一个</button><button class="button button-quiet" data-action="teaching-next" ${index >= items.length - 1 ? 'disabled' : ''}>下一个 →</button></div>`
  }

  function renderInput() {
    return `<div class="tool-layout"><div class="tool-copy"><h2>在线输入</h2><p>用数字小键盘输入盲文。点位键只更新当前方，按 0 才会提交。</p><div class="key-row"><kbd>7</kbd><kbd>4</kbd><kbd>1</kbd><kbd>8</kbd><kbd>5</kbd><kbd>2</kbd></div></div><div class="input-tool"><div class="input-tool-current">${state.input.confirmedCells.map(cell => cellsToUnicode([cell])).join('')}<span>${state.input.currentDots.length ? '⠿' : ''}</span></div><div class="input-output" aria-live="polite">${esc(inputOutput || '等待输入')}</div><p class="helper">按 * 确认当前方，按 0 上屏</p></div></div>`
  }

  function renderExperiment() {
    const model = experiment.snapshot()
    return `<section class="page page-experiment"><div class="page-heading"><div><p class="eyebrow">AUDIOBRAILLE LAB</p><h1>AudioBraille 实验</h1><p class="lead">测试一种通过空间音频聆听盲文的新途径。</p></div></div><div class="tabs"><button class="tab${state.experimentTab === 'recognition' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="recognition">听觉辨识</button><button class="tab${state.experimentTab === 'reader' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="reader">听书场景</button></div>${state.experimentTab === 'recognition' ? renderRecognition(model) : renderReader()}</section>`
  }

  function renderRecognition(model) {
    const modes = [['letters', '字母'], ['syllables', '拼音音节'], ['symbols', '符号'], ['digits', '数字']]
    let body = `<p>先选择一类，开始后会先展示左右耳和音高的对应关系。</p><div class="mode-picker">${modes.map(([id, label]) => `<button class="mode-chip${model.mode === id ? ' is-active' : ''}" data-action="experiment-mode" data-mode="${id}">${label}</button>`).join('')}</div>`
    if (model.stage === 'idle') body += `<button class="button button-primary" data-action="experiment-start">开始一轮实验</button>`
    if (model.stage === 'showcase') body += `<div class="experiment-status"><strong>展示阶段</strong><p>依次听点 1 到点 6，熟悉左/右耳和高/中/低音的对应关系。</p><button class="button button-primary" data-action="experiment-confirm">我已听完展示，进入测试</button></div>`
    if (model.stage === 'listen' || model.stage === 'answer') {
      const trial = model.trials[model.index]
      body += `<div class="experiment-status"><strong>第 ${model.index + 1} / ${model.trials.length} 题</strong><p>${model.stage === 'listen' ? '按 0 或点击按钮听音频。' : '输入听到的盲文方，按 0 提交。'}</p><button class="button button-primary" data-action="experiment-listen">${model.stage === 'listen' ? '播放本题音频' : '重听本题'}</button><div class="input-preview">${state.input.confirmedCells.map(cell => cellsToUnicode([cell])).join('')}${state.input.currentDots.length ? '…' : ''}</div></div>`
      if (trial) body += `<p class="sr-only">本题需要 ${trial.cells.length} 方</p>`
    }
    if (model.stage === 'done') body += `<div class="experiment-status"><h2>本轮完成</h2><p>正确 ${model.results.filter(result => result.correct).length} / ${model.results.length}</p><button class="button button-primary" data-action="experiment-restart">再来一轮</button></div>`
    return `<div class="experiment-panel">${body}</div>`
  }

  function renderReader() {
    return `<div class="reader-panel"><h2>听书场景</h2><p>这是 AudioBraille 的连续播放测试。输入盲文内容，或先使用内置短文。</p><textarea id="reader-text" rows="4">${esc(currentReaderText)}</textarea><label class="range-label">速度 <input id="reader-speed" type="range" min="0.5" max="5" step="0.5" value="${reader.getSpeed()}"><output>${reader.getSpeed()}x</output></label><div class="button-row"><button class="button button-primary" data-action="reader-play">播放 AudioBraille</button><button class="button button-quiet" data-action="reader-stop">停止</button></div><div id="reader-progress" aria-live="polite"></div></div>`
  }

  function renderNotes() {
    const legacy = notes.view()
    legacy.querySelector('h1')?.remove()
    return `<section class="page page-notes"><div class="page-heading"><div><p class="eyebrow">NOTES</p><h1>笔记</h1><p class="lead">用盲文记录，也可以分别用文字或 AudioBraille 回听。</p></div></div>${legacy.innerHTML}</section>`
  }

  function render() {
    if (!main) return
    document.querySelectorAll('.main-nav [data-action]').forEach(button => {
      const item = buildTopNav(getLang()).find(value => value.id === button.dataset.action)
      if (item) button.textContent = item.label
      button.setAttribute('aria-current', button.dataset.action === state.page ? 'true' : 'false')
    })
    let html = state.page === 'home' ? renderHome() : state.page === 'learning' ? renderLearning() : state.page === 'experiment' ? renderExperiment() : renderNotes()
    main.innerHTML = html
    if (state.page === 'notes') notes.updateReference?.()
    bindDynamicState()
  }

  function bindDynamicState() {
    const readerSpeed = document.querySelector('#reader-speed')
    readerSpeed?.addEventListener('input', event => {
      reader.setSpeed(event.target.value)
      const output = event.target.parentElement.querySelector('output')
      if (output) output.value = `${reader.getSpeed()}x`
    })
    const noteArea = document.querySelector('#note-textarea')
    noteArea?.addEventListener('input', () => {
      noteText = noteArea.value
      notes.updateReference?.()
    })
    const importFile = document.querySelector('#note-import-file')
    importFile?.addEventListener('change', () => {
      const file = importFile.files?.[0]
      if (file) void notes.importNote(file)
    })
  }

  async function playCells(cells) {
    const token = ++experimentToken
    for (const cell of buildCellSequence(cells)) {
      if (token !== experimentToken) return
      await playAudioBraille(cell, { duration: 0.35 })
      await new Promise(resolve => setTimeout(resolve, 120))
    }
  }

  async function commitLearning(cells) {
    const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang())
    if (!item) return
    const correct = JSON.stringify(cells.map(cell => [...cell].sort((a, b) => a - b))) === JSON.stringify(item.cells.map(cell => [...cell].sort((a, b) => a - b)))
    if (correct) speak('正确')
    else speak(`错误，正确盲文是 ${item.unicode}，点位 ${pointsText(item.cells)}`)
    state.input = { confirmedCells: [], currentDots: [] }
    if (correct && state.teaching.phase === 'practice') render()
  }

  function onAction(event) {
    const target = event.target.closest('[data-action]')
    if (!target) return
    const action = target.dataset.action
    if (action === 'home') state = { ...state, page: 'home' }
    else if (action === 'learning') state = { ...state, page: 'learning', learningTab: 'teaching' }
    else if (action === 'experiment') state = { ...state, page: 'experiment' }
    else if (action === 'notes') state = { ...state, page: 'notes' }
    else if (action === 'guide') document.querySelector('.guide-fold')?.setAttribute('open', '')
    else if (action === 'toggle-language') {
      const next = getLang() === 'en' ? 'zh' : 'en'
      setLang(next)
      cancelSpeech()
      render()
    }
    else if (action === 'speak-guide') speak('小键盘七、四、一对应盲文点一、二、三；八、五、二对应点四、五、六。零提交，星号下一方，斜杠上一方，三退格，减号清空，加号朗读，句号空格。')
    else if (action === 'toggle-language') {
      const next = getLang() === 'en' ? 'zh' : 'en'
      setLang(next)
      cancelSpeech()
    }
    else if (action === 'learning-tab') state = { ...state, learningTab: target.dataset.tab }
    else if (action === 'experiment-tab') { experimentToken++; reader.stop(); cancelSpeech(); state = { ...state, experimentTab: target.dataset.tab } }
    else if (action === 'teaching-home') state = { ...state, teaching: { ...state.teaching, category: null, section: null, item: null } }
    else if (action === 'teaching-category') state = { ...state, teaching: { ...state.teaching, category: target.dataset.category, section: null, item: null } }
    else if (action === 'teaching-continue') {
      const section = target.dataset.section
      const p = sectionProgress(state.teaching.category, section)
      state = { ...state, teaching: { ...state.teaching, section, item: p.current || getTeachingSections(state.teaching.category).find(value => value.id === section).items[0], phase: 'learn' } }
    } else if (action === 'teaching-item') state = { ...state, teaching: { ...state.teaching, section: target.dataset.section, item: decodeURIComponent(target.dataset.item), phase: 'learn' }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-back-section') state = { ...state, teaching: { ...state.teaching, section: null, item: null }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-phase') state = { ...state, teaching: { ...state.teaching, phase: target.dataset.phase }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-prev' || action === 'teaching-next') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const index = section.items.indexOf(state.teaching.item) + (action === 'teaching-prev' ? -1 : 1)
      if (section.items[index]) state = { ...state, teaching: { ...state.teaching, item: section.items[index] }, input: { confirmedCells: [], currentDots: [] } }
    } else if (action === 'play-item') { const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang()); if (item) { speak(buildTeachingSpeech(item, getLang())); void playCells(item.cells) } }
    else if (action === 'mark-learned') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const old = sectionProgress(state.teaching.category, state.teaching.section)
      const next = markTeachingLearned(old, state.teaching.item, section.items)
      saveSectionProgress(state.teaching.category, state.teaching.section, next)
      void progress.markLearned(state.teaching.category, state.teaching.section, state.teaching.item)
      state = { ...state, teaching: { ...state.teaching, item: next.current || state.teaching.item } }
    } else if (action === 'experiment-mode') { experimentToken++; cancelSpeech(); experiment.selectMode(target.dataset.mode); state = { ...state, input: { confirmedCells: [], currentDots: [] } } }
    else if (action === 'experiment-start') { experiment.start(); state = { ...state, input: { confirmedCells: [], currentDots: [] } }; void playShowcase() }
    else if (action === 'experiment-confirm') { experiment.confirmShowcase(); render() }
    else if (action === 'experiment-listen') {
      const current = experiment.snapshot().trials[experiment.snapshot().index]
      if (current) void playCells(current.cells)
      if (experiment.snapshot().stage === 'listen') experiment.listen()
      render()
    }
    else if (action === 'experiment-restart') { experiment.restart(); state = { ...state, input: { confirmedCells: [], currentDots: [] } } }
    else if (action === 'reader-play') { currentReaderText = document.querySelector('#reader-text')?.value || SAMPLE_TEXT; reader.stop(); void reader.play(currentReaderText) }
    else if (action === 'reader-stop') reader.stop()
    else if (action === 'notes-save') void notes.save()
    else if (action === 'notes-play-text') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('tts') }
    else if (action === 'notes-play-audio') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('braille', Number(document.querySelector('#notes-speed')?.value || 1)) }
    else if (action === 'notes-export') void notes.exportNote('json')
    else if (action === 'notes-import') document.querySelector('#note-import-file')?.click()
    else if (action === 'notes-new') notes.newNote()
    else if (TOP_LEVEL_PAGES.includes(action)) { experimentToken++; reader.stop(); cancelSpeech(); state = { ...state, page: action, input: { confirmedCells: [], currentDots: [] } } }
    render()
  }

  async function playShowcase() {
    const token = ++experimentToken
    for (const point of buildShowcase()) {
      if (token !== experimentToken) return
      await playAudioBraille(point.dots, { duration: 0.35 })
      speak(point.desc)
      await new Promise(resolve => setTimeout(resolve, 400))
    }
  }

  function onKeydown(event) {
    if (!gateOpen) return
    if (event.ctrlKey || event.altKey || event.metaKey) return
    if (event.key === 'F1') { event.preventDefault(); speak('按零提交，星号下一方，斜杠上一方，三退格，减号清空，加号朗读，句号空格。'); return }
    const point = keyToPoint(event.key)
    if (point !== null) {
      event.preventDefault()
      const dots = [...state.input.currentDots]
      if (!dots.includes(point)) dots.push(point)
      dots.sort((a, b) => a - b)
      state = { ...state, input: { ...state.input, currentDots: dots } }
      render()
      return
    }
    const accepted = ['0', '*', '/', '3', '-', '+', '.']
    if (!accepted.includes(event.key)) return
    event.preventDefault()
    const experimentState = state.page === 'experiment' && state.experimentTab === 'recognition' ? experiment.snapshot() : null
    if (event.key === '0' && experimentState?.stage === 'listen') {
      const trial = experimentState.trials[experimentState.index]
      if (trial) void playCells(trial.cells)
      experiment.listen()
      render()
      return
    }
    if (event.key === '0' && experimentState?.stage === 'answer' && state.input.confirmedCells.length === 0 && state.input.currentDots.length === 0) {
      const trial = experimentState.trials[experimentState.index]
      if (trial) void playCells(trial.cells)
      return
    }
    if (event.key === '.') {
      if (state.page === 'notes') {
        const textarea = document.querySelector('#note-textarea')
        if (textarea) {
          textarea.value += ' '
          notes.updateReference?.()
        }
      } else if (state.page === 'learning' && state.learningTab === 'input') {
        inputOutput += ' '
      }
      render()
      return
    }
    const controller = createInputController({ onCommit: cells => {
      if (state.page === 'learning' && state.learningTab === 'teaching' && state.teaching.item) void commitLearning(cells)
      else if (state.page === 'experiment' && experiment.snapshot().stage === 'answer') {
        const result = experiment.submit(cells)
        if (!result.correct) speak(`错误，正确答案是 ${experiment.snapshot().trials[experiment.snapshot().index - 1]?.label || ''}`)
        else speak('正确')
      } else if (state.page === 'learning' && state.learningTab === 'input') {
        inputOutput += cellsToUnicode(cells)
      } else if (state.page === 'notes') {
        const textarea = document.querySelector('#note-textarea')
        if (textarea) {
          textarea.value += cellsToUnicode(cells)
          notes.updateReference?.()
        }
      }
    }, onSpeech: text => speak(text) })
    const pointKeys = { 1: '7', 2: '4', 3: '1', 4: '8', 5: '5', 6: '2' }
    for (const cell of state.input.confirmedCells) {
      for (const dot of cell) controller.handleKey(pointKeys[dot])
      controller.handleKey('*')
    }
    for (const dot of state.input.currentDots) controller.handleKey(pointKeys[dot])
    controller.handleKey(event.key)
    const next = controller.snapshot()
    state = { ...state, input: next }
    if (event.key === '+' && state.page === 'learning' && state.teaching.item) { const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item); if (item) void playCells(item.cells) }
    if (event.key === '+' && state.page === 'notes') void notes.readAloud('braille')
    render()
  }

  function openApp() {
    gateOpen = true
    state = { ...state, audioUnlocked: true }
    unlockAudio()
    document.querySelector('#start-gate')?.remove()
    document.removeEventListener('click', onGateClick, true)
    window.removeEventListener('keydown', onGateKey, true)
    cancelSpeech()
    speak('欢迎使用 AudioBraille')
    render()
  }

  function onGateKey(event) {
    if (event.key !== '0') { event.preventDefault(); event.stopPropagation(); return }
    event.preventDefault(); event.stopPropagation(); openApp()
  }
  function onGateClick(event) {
    if (event.target.closest('#start-gate')) return
    event.preventDefault(); event.stopPropagation()
  }

  document.addEventListener('click', onAction)
  document.addEventListener('click', onGateClick, true)
  window.addEventListener('keydown', onGateKey, true)
  window.addEventListener('keydown', onKeydown)
  render()
}
