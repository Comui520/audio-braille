// src/app.js —— v9：单一应用壳、四入口、统一事件路由
import './styles.css'
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { createAppState, TOP_LEVEL_PAGES } from './app-state.js'
import { createInputController, keyToPoint } from './input.js'
import { createProgressStore } from './curriculum.js'
import { getTeachingCategories, getTeachingSections, getTeachingItems, getTeachingItem, markTeachingLearned, buildItemSpeech } from './teaching.js'
import { createExperimentModel, buildShowcase, buildShowcaseInstruction } from './experiment.js'
import { createReader, SAMPLE_BRAILLE, buildReaderComprehensionHtml, createReaderTrialRecord } from './reader.js'
import { READER_PASSAGES, sampleReaderPassages } from './data/reader-passages.js'
import { initNotes } from './notes.js'
import { playAudioBraille, buildCellSequence, unlockAudio } from './audio-braille.js'
import { speak, speakAndWait, cancelSpeech } from './speech.js'
import { getLang, setLang, t } from './i18n.js'
import { validateParticipantProfile, deriveCohort, STUDY_VERSION } from './experiment-protocol.js'
import { toCells, cellsToUnicode, cellsToDiagram, keyHintForCells } from './cells.js'
import { dotsToUnicode, unicodeToDots } from './braille-engine.js'
import { buildInputDisplayModel } from './input-display.js'

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
    { action: 'notes', icon: '记', label: '笔记' }
  ]
}

export function appendSpace(existing = '') {
  return `${existing} `
}

export function buildResearchEntryHtml() {
  return `<section class="research-entry"><h2>正式实验</h2><p>本实验收集匿名的听觉辨识和听书体验数据，用于研究 AudioBraille 的可用性。你可以随时停止。</p><label><input type="checkbox" data-field="consent"> 我同意匿名实验数据用于研究</label><label>视力状态<select data-field="visionStatus"><option value="sighted">明眼</option><option value="low-vision">低视力</option><option value="blind">盲人</option><option value="undisclosed">不愿回答</option></select></label><label>盲文经验<select data-field="brailleExperience"><option value="none">没有盲文经验</option><option value="beginner">初学盲文</option><option value="experienced">熟悉盲文</option><option value="undisclosed">不愿回答</option></select></label><label>AudioBraille 经验<select data-field="audioEncodingExperience"><option value="none">没有 AudioBraille 经验</option><option value="some">接触过类似听觉编码</option><option value="audiobraille-trained">完成过 AudioBraille 训练</option><option value="undisclosed">不愿回答</option></select></label><button class="button button-primary" data-action="research-submit">进入训练和校准</button></section>`
}


export function editorTextToAtoms(text = '') {
  return [...String(text)].map(char => {
    const code = char.codePointAt(0)
    if (code >= 0x2800 && code <= 0x28ff) return [unicodeToDots(char)]
    if (char === ' ') return null
    return { kind: 'text', value: char }
  })
}

export function editorAtomsToText(atoms = []) {
  return (Array.isArray(atoms) ? atoms : []).map(atom => {
    if (Array.isArray(atom)) return cellsToUnicode(atom)
    if (atom === null) return ' '
    return atom && atom.kind === 'text' ? atom.value || '' : ''
  }).join('')
}

export function editorCursorToOffset(atoms = [], cursor = 0) {
  const safeAtoms = Array.isArray(atoms) ? atoms : []
  const safeCursor = Math.max(0, Math.min(Number(cursor) || 0, safeAtoms.length))
  return safeAtoms.slice(0, safeCursor)
    .reduce((offset, atom) => offset + editorAtomsToText([atom]).length, 0)
}

export function editorOffsetToCursor(atoms = [], offset = 0) {
  const safeAtoms = Array.isArray(atoms) ? atoms : []
  const safeOffset = Math.max(0, Number(offset) || 0)
  let consumed = 0
  for (let index = 0; index < safeAtoms.length; index += 1) {
    const length = editorAtomsToText([safeAtoms[index]]).length
    if (safeOffset < consumed + length) return index
    consumed += length
    if (safeOffset === consumed) return index + 1
  }
  return safeAtoms.length
}

export function buildTextareaDocumentHtml(text = '', { id = 'note-textarea', rows = 10, label = '笔记内容', readOnly = false } = {}) {
  const readonly = readOnly ? ' readonly' : ''
  return `<textarea id="${id}" rows="${rows}" wrap="soft" aria-label="${label}"${readonly}>${esc(text)}</textarea>`
}

export function buildTonePickerHtml(selected = null) {
  const tones = [[null, '无调'], ['1', '阴平'], ['2', '阳平'], ['3', '上声'], ['4', '去声']]
  return `<div class="tone-picker" role="group" aria-label="选择声调">${tones.map(([tone, label]) => `<button class="tone-option${selected === tone ? ' is-active' : ''}" data-action="teaching-tone" data-tone="${tone ?? ''}">${label}</button>`).join('')}</div>`
}

export function buildLearningPlayback(item) {
  return { cells: item?.cells || [], speech: null }
}

export function appendCommittedBraille(existing, cells) {
  return `${existing || ''}${cellsToUnicode(cells)}`
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

function inputDisplayHtml(confirmedCells, currentDots, cursorIndex, label = '当前输入') {
  const models = buildInputDisplayModel(confirmedCells, currentDots, cursorIndex)
  return `<div class="input-display composition-display" aria-label="${label}">${models.map((model, index) => {
    const kindClass = model.kind === 'space' ? ' is-space' : model.kind === 'text' ? ' is-text' : ''
    const content = model.kind === 'space'
      ? '<span class="input-space-marker" aria-hidden="true">␠</span>'
      : model.kind === 'text'
        ? `<span class="input-text-marker">${esc(model.text)}</span>`
        : model.dots.map((on, dot) => `<i class="input-dot${on ? ' is-on' : ''}" data-dot="${dot + 1}"></i>`).join('')
    const itemLabel = model.kind === 'current'
      ? '当前方'
      : model.kind === 'space'
        ? `已确认第 ${index + 1} 个空格`
        : model.kind === 'text'
          ? `已确认第 ${index + 1} 个文字字符`
          : `已确认第 ${index + 1} 方`
    return `<div class="input-cell${kindClass}${model.cursor ? ' is-cursor' : ''}" aria-label="${itemLabel}">${content}</div>`
  }).join('<span class="cell-separator" aria-hidden="true">；</span>')}</div>`
}

export function initApp() {
  applyTheme()
  let state = createAppState()
  const storage = createStorage()
  const progress = createProgressStore(storage)
  const notes = initNotes({
    state,
    storage,
    render,
    getDocumentCells: () => editorDocuments.notes?.cells,
    setDocument: (cells, fallbackText = '') => {
      if (Array.isArray(cells)) editorControllers.notes.setDocument(cells, cells.length)
      else loadEditorText('notes', fallbackText)
    }
  })
  let selectedReaderPassage = READER_PASSAGES[0]
  let readerPassages = READER_PASSAGES
  let readerCompleted = false
  let readerUnderstood = null
  let readerSummary = ''
  let readerTrialRecord = null
  let readerPlayStartedAt = null
  let readerReplayCount = 0
  const reader = createReader({ onTick: (position, total) => {
    const el = document.querySelector('#reader-progress')
    if (el) el.textContent = `${position} / ${total}`
  }, onComplete: () => {
    readerCompleted = true
    readerTrialRecord = createReaderTrialRecord({
      passageId: selectedReaderPassage.passageId,
      passageVersion: selectedReaderPassage.passageVersion,
      passageIndex: readerPassages.findIndex(passage => passage.passageId === selectedReaderPassage.passageId),
      playStartedAt: readerPlayStartedAt,
      playCompletedAt: Date.now(),
      playedDurationMs: readerPlayStartedAt ? Date.now() - readerPlayStartedAt : null,
      completed: true,
      replayCount: readerReplayCount,
      playbackSpeed: reader.getSpeed()
    })
    render()
  } })
  let experiment = createExperimentModel({ trialCount: 10 })
  let noteText = ''
  let inputOutput = ''
  let progressCache = {}
  let currentReaderText = SAMPLE_BRAILLE
  const readerAtoms = editorTextToAtoms(SAMPLE_BRAILLE)
  const editorDocuments = {
    online: { cells: [], cursor: 0 },
    notes: { cells: [], cursor: 0 },
    reader: { cells: readerAtoms, cursor: readerAtoms.length }
  }
  let experimentToken = 0
  let gateOpen = false
  let experimentEntryError = ''

  function createSessionId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function beginFormalExperiment() {
    const consent = document.querySelector('[data-field="consent"]')?.checked === true
    const profile = {
      visionStatus: document.querySelector('[data-field="visionStatus"]')?.value,
      brailleExperience: document.querySelector('[data-field="brailleExperience"]')?.value,
      audioEncodingExperience: document.querySelector('[data-field="audioEncodingExperience"]')?.value
    }
    if (!consent) {
      experimentEntryError = '开始正式实验前，请先同意匿名数据用于研究。'
      return false
    }
    if (!validateParticipantProfile(profile).valid) {
      experimentEntryError = '请完成参与者背景字段。'
      return false
    }
    const participantId = createSessionId('participant')
    const sessionId = createSessionId('session')
    experiment = createExperimentModel({
      trialCount: 10,
      dataClass: 'formal',
      studyVersion: STUDY_VERSION,
      consentAccepted: true,
      participantId,
      sessionId
    })
    experimentEntryError = ''
    readerPassages = sampleReaderPassages(READER_PASSAGES, 3, sessionId)
    selectedReaderPassage = readerPassages[0]
    state = { ...state, experiment: { ...state.experiment, researchMode: 'formal', formalPhase: 'training', participantId, sessionId, profile: { ...profile, cohort: deriveCohort(profile) }, consentAccepted: true } }
    experiment.startTraining()
    return true
  }

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
    const raw = progressCache[`${category}.${section}`] || { learned: [], current: null }
    if (category !== 'pinyin' || section !== 'syllables') return raw
    return {
      learned: [...new Set((raw.learned || []).map(item => String(item).replace(/[1-4]$/, '')))],
      current: raw.current ? String(raw.current).replace(/[1-4]$/, '') : null
    }
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
      <div class="home-actions">${buildHomeActions().map(item => `<button class="home-action" data-action="${item.action}"><span class="action-icon">${item.icon}</span><span>${item.label}</span><small>${item.action === 'experiment' ? '听觉辨识与听书场景' : item.action === 'learning' ? '从字母、拼音到数字和符号' : '记录、导入、导出与朗读'}</small></button>`).join('')}</div>
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
    const item = getTeachingItem(teaching.category, teaching.section, teaching.item, getLang(), teaching.tone)
    if (!item) return `<div class="empty-state">找不到这个学习项目<button class="button" data-action="teaching-back-section">返回</button></div>`
    const section = getTeachingSections(teaching.category, getLang()).find(value => value.id === teaching.section)
    const items = section?.items || []
    const index = items.indexOf(teaching.item)
    const practice = teaching.phase !== 'learn'
    return `<div class="subhead"><button class="button button-quiet" data-action="teaching-back-section">← ${esc(section?.label || '列表')}</button><span class="item-position">${index + 1} / ${items.length}</span></div>
      <div class="lesson-layout">
        <div class="lesson-summary"><p class="eyebrow">${esc(item.type)}</p><h2>${esc(item.label)}</h2><p class="lesson-note">${item.type === 'initial' ? '声母' : item.type === 'final' ? '韵母' : item.type === 'syllable' ? `音节${item.toneName ? ` · ${item.toneName}` : ''}` : ''}</p></div>
        <div class="lesson-braille"><div class="lesson-unicode">${esc(item.unicode)}</div>${diagramHtml(item.cells)}<p>点位：${esc(pointsText(item.cells))}</p><p>键位：<strong>${esc(keyHintForCells(item.cells))}</strong></p>${item.type === 'syllable' ? `<div class="syllable-tone-picker">${buildTonePickerHtml(teaching.tone)}<p class="tone-status">${item.toneName || '无调'} · ${item.cells.length}方${teaching.tone && item.cells.length < 3 ? ' · 按国家通用盲文规则省写' : ''}</p></div>` : ''}</div>
        <div class="lesson-actions"><button class="button button-primary" data-action="play-item">播放 AudioBraille</button><button class="button button-success" data-action="mark-learned">标记为已学</button></div>
      </div>
      <div class="phase-tabs"><button class="tab${teaching.phase === 'learn' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="learn">学</button><button class="tab${teaching.phase === 'practice' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="practice">练</button><button class="tab${teaching.phase === 'exam' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="exam">考</button></div>
      <div class="phase-panel">${practice ? `<p>${teaching.phase === 'practice' ? '请根据上方提示输入，按 0 提交。' : '不看答案，输入这个项目的盲文，按 0 提交。'}</p><div class="input-preview" id="learning-input-preview">${inputDisplayHtml(state.input.confirmedCells, state.input.currentDots, state.input.cursorIndex, '学习输入')}</div>` : `<p>${esc(buildItemSpeech(item, getLang()))}</p>`}</div>
      <div class="item-nav"><button class="button button-quiet" data-action="teaching-prev" ${index <= 0 ? 'disabled' : ''}>← 上一个</button><button class="button button-quiet" data-action="teaching-next" ${index >= items.length - 1 ? 'disabled' : ''}>下一个 →</button></div>`
  }

  function renderInput() {
    const input = state.input
    const composition = input.compositionCells || input.confirmedCells
    const compositionCursor = input.compositionCursor ?? input.cursorIndex
    return `<div class="tool-layout"><div class="tool-copy"><h2>在线输入</h2><p>用数字小键盘输入盲文。上方只显示当前多方，按 0 确认后进入下方文档。</p><div class="key-row"><kbd>7</kbd><kbd>4</kbd><kbd>1</kbd><kbd>8</kbd><kbd>5</kbd><kbd>2</kbd></div></div><div class="input-tool"><div class="input-section-label">当前多方输入</div>${inputDisplayHtml(composition, input.currentDots, compositionCursor, '当前多方输入')}<div class="input-output" aria-live="polite">${esc(inputOutput || '等待输入')}</div><p class="helper">按 * 确认当前方，按 0 确认整组；当前组为空时，按 / 或 * 移动文档光标</p></div></div>`
  }

  function renderExperiment() {
    const model = experiment.snapshot()
    if (state.experiment.researchMode === 'entry') {
      return `<section class="page page-experiment"><div class="page-heading"><div><p class="eyebrow">AUDIOBRAILLE LAB</p><h1>AudioBraille 实验</h1></div></div><button class="button button-quiet" data-action="research-cancel">返回试玩实验</button>${buildResearchEntryHtml()}${experimentEntryError ? `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>` : ''}</section>`
    }
    return `<section class="page page-experiment"><div class="page-heading"><div><p class="eyebrow">AUDIOBRAILLE LAB</p><h1>AudioBraille 实验</h1><p class="lead">测试一种通过空间音频聆听盲文的新途径。</p></div></div><div class="tabs"><button class="tab${state.experimentTab === 'recognition' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="recognition">听觉辨识</button><button class="tab${state.experimentTab === 'reader' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="reader">听书场景</button></div>${state.experimentTab === 'recognition' ? renderRecognition(model) : renderReader()}</section>`
  }

  function renderRecognition(model) {
    const modes = [['letters', '字母'], ['syllables', '拼音音节'], ['symbols', '符号'], ['digits', '数字']]
    let body = `<p>选择试玩或进入正式实验。正式实验会先完成统一训练和校准。</p><div class="mode-picker">${modes.map(([id, label]) => `<button class="mode-chip${model.mode === id ? ' is-active' : ''}" data-action="experiment-mode" data-mode="${id}">${label}</button>`).join('')}</div>`
    if (model.stage === 'idle') {
      if (state.experiment.researchMode === 'formal' && state.experiment.formalPhase === 'recognition') body += `<button class="button button-primary" data-action="experiment-start">开始正式辨识</button>`
      else body += `<button class="button button-primary" data-action="experiment-start">开始试玩一轮</button><button class="button button-secondary" data-action="research-entry">进入正式实验</button>`
    }
    if (model.stage === 'training') body += `<div class="experiment-status"><strong>统一训练和校准</strong><p>请先听完整规则、六个单点和多点示例，再完成固定校准题。训练数据不会计入正式结果。</p><button class="button button-success" data-action="research-calibration-pass">校准通过</button><button class="button button-quiet" data-action="research-calibration-fail">需要重试</button></div>`
    if (model.stage === 'showcase') body += `<div class="experiment-status"><strong>展示阶段</strong><p>先听一次完整说明，随后依次播放六个声音。当前：<span id="showcase-current">准备开始</span></p><button class="button button-primary" data-action="experiment-confirm">我已听完展示，进入测试</button></div>`
    if (model.stage === 'listen' || model.stage === 'answer') {
      const trial = model.trials[model.index]
      body += `<div class="experiment-status"><strong>第 ${model.index + 1} / ${model.trials.length} 题</strong><p>${model.stage === 'listen' ? '按 0 或点击按钮听音频。' : '输入听到的盲文方，按 0 提交。'}</p><button class="button button-primary" data-action="experiment-listen">${model.stage === 'listen' ? '播放本题音频' : '重听本题'}</button>${inputDisplayHtml(state.input.confirmedCells, state.input.currentDots, state.input.cursorIndex, '实验输入盲文点位')}</div>`
      if (trial) body += `<p class="sr-only">本题需要 ${trial.cells.length} 方</p>`
    }
    if (model.stage === 'done') body += `<div class="experiment-status"><h2>本轮完成</h2><p>正确 ${model.results.filter(result => result.correct).length} / ${model.results.length}</p><button class="button button-primary" data-action="experiment-restart">再来一轮</button></div>`
    if (model.blocked) body += `<p class="form-error" role="alert">正式实验需要先完成同意和身份字段。</p>`
    return `<div class="experiment-panel">${body}</div>`
  }

  function renderReader() {
    const input = state.input
    const composition = input.compositionCells || input.confirmedCells
    const compositionCursor = input.compositionCursor ?? input.cursorIndex
    const passageOptions = readerPassages.map(passage => `<option value="${passage.passageId}"${passage.passageId === selectedReaderPassage.passageId ? ' selected' : ''}>${esc(passage.title)} · ${passage.lengthStratum}</option>`).join('')
    return `<div class="reader-panel"><h2>听书场景</h2><p>选择一段材料，播放完成后再填写理解反馈。</p><label>材料<select id="reader-passage" data-action="reader-passage">${passageOptions}</select></label><p class="reader-passage-meta">${esc(selectedReaderPassage.topicStratum)} · ${esc(selectedReaderPassage.difficultyStratum)}</p><p>${esc(selectedReaderPassage.text)}</p><div class="reader-input-preview">${inputDisplayHtml(composition, input.currentDots, compositionCursor, '当前多方输入')}</div>${buildTextareaDocumentHtml(currentReaderText, { id: 'reader-text', rows: 4, label: '盲文内容' })}<label class="range-label">速度 <input id="reader-speed" type="range" min="0.5" max="5" step="0.5" value="${reader.getSpeed()}"><output>${reader.getSpeed()}x</output></label><div class="button-row"><button class="button button-primary" data-action="reader-play">播放 AudioBraille</button><button class="button button-quiet" data-action="reader-stop">停止</button></div><div id="reader-progress" aria-live="polite"></div>${buildReaderComprehensionHtml({ completed: readerCompleted, understood: readerUnderstood, summaryText: readerSummary })}</div>`
  }

  function renderNotes() {
    const legacy = notes.view()
    legacy.querySelector('h1')?.remove()
    const textarea = legacy.querySelector('#note-textarea')
    if (textarea) {
      const input = state.input
      const composition = input.compositionCells || input.confirmedCells
      const compositionCursor = input.compositionCursor ?? input.cursorIndex
      textarea.value = noteText
      textarea.textContent = noteText
      textarea.insertAdjacentHTML('beforebegin', inputDisplayHtml(composition, input.currentDots, compositionCursor, '当前多方输入'))
    }
    return `<section class="page page-notes"><div class="page-heading"><div><p class="eyebrow">NOTES</p><h1>笔记</h1><p class="lead">用盲文记录，也可以分别用文字或 AudioBraille 回听。</p></div></div>${legacy.innerHTML}</section>`
  }

  function restoreEditorSelection(name, preserveFocus = false) {
    if (!name) return
    const textarea = document.querySelector(name === 'notes' ? '#note-textarea' : '#reader-text')
    const documentState = editorDocuments[name]
    if (!textarea || !documentState) return
    const text = editorAtomsToText(documentState.cells)
    if (textarea.value !== text) textarea.value = text
    const offset = editorCursorToOffset(documentState.cells, documentState.cursor)
    if (preserveFocus) textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(offset, offset)
  }

  function render() {
    if (!main) return
    const editorNameBeforeRender = activeEditorName()
    const editorElementBeforeRender = editorNameBeforeRender
      ? document.querySelector(editorNameBeforeRender === 'notes' ? '#note-textarea' : '#reader-text')
      : null
    const preserveEditorFocus = editorElementBeforeRender && document.activeElement === editorElementBeforeRender
    const currentController = activeController()
    if (currentController) setInputSnapshot(currentController.snapshot())
    document.querySelectorAll('.main-nav [data-action]').forEach(button => {
      const item = buildTopNav(getLang()).find(value => value.id === button.dataset.action)
      if (item) button.textContent = item.label
      button.setAttribute('aria-current', button.dataset.action === state.page ? 'true' : 'false')
    })
    let html = state.page === 'home' ? renderHome() : state.page === 'learning' ? renderLearning() : state.page === 'experiment' ? renderExperiment() : renderNotes()
    main.innerHTML = html
    if (state.page === 'notes') notes.updateReference?.()
    bindDynamicState()
    restoreEditorSelection(editorNameBeforeRender, Boolean(preserveEditorFocus))
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
      loadEditorText('notes', noteText, noteArea.selectionStart)
      notes.updateReference?.()
    })
    const readerText = document.querySelector('#reader-text')
    readerText?.addEventListener('input', () => {
      currentReaderText = readerText.value
      loadEditorText('reader', currentReaderText, readerText.selectionStart)
    })
    const readerPassage = document.querySelector('#reader-passage')
    readerPassage?.addEventListener('change', () => {
      selectedReaderPassage = readerPassages.find(passage => passage.passageId === readerPassage.value) || readerPassages[0]
      readerCompleted = false
      readerUnderstood = null
      readerSummary = ''
      render()
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
    const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang(), state.teaching.tone)
    if (!item) return
    const correct = JSON.stringify(cells.map(cell => [...cell].sort((a, b) => a - b))) === JSON.stringify(item.cells.map(cell => [...cell].sort((a, b) => a - b)))
    if (correct) speak('正确')
    else speak(`错误，正确盲文是 ${item.unicode}，点位 ${pointsText(item.cells)}`)
    state.input = { confirmedCells: [], currentDots: [] }
    if (correct && state.teaching.phase === 'practice') render()
  }

  const inputController = createInputController({
    onCommit: onInputCommit,
    onSpeech: text => speak(text),
    onBackspace: () => {
      if (state.page === 'notes') {
        noteText = [...noteText].slice(0, -1).join('')
      } else if (state.page === 'experiment' && state.experimentTab === 'reader') {
        currentReaderText = [...currentReaderText].slice(0, -1).join('')
      } else if (state.page === 'learning' && state.learningTab === 'input') {
        inputOutput = [...inputOutput].slice(0, -1).join('')
      }
    }
  })

  function activeEditorName() {
    if (state.page === 'notes') return 'notes'
    if (state.page === 'experiment' && state.experimentTab === 'reader') return 'reader'
    if (state.page === 'learning' && state.learningTab === 'input') return 'online'
    return null
  }

  function activeController() {
    const name = activeEditorName()
    return name ? editorControllers[name] : inputController
  }

  function syncEditorValue(name, snapshot) {
    const cells = snapshot.documentCells.map(atom => Array.isArray(atom)
      ? atom.map(cell => [...cell])
      : (atom && typeof atom === 'object' ? { ...atom } : atom))
    editorDocuments[name] = { cells, cursor: snapshot.documentCursor }
    const text = editorAtomsToText(cells)
    if (name === 'notes') noteText = text
    if (name === 'reader') currentReaderText = text
    if (name === 'online') inputOutput = text
    if (activeEditorName() === name) setInputSnapshot(snapshot)
    if (name === 'notes') {
      const textarea = document.querySelector('#note-textarea')
      if (textarea && textarea.value !== text) {
        textarea.value = text
        textarea.textContent = text
      }
      notes.updateReference?.()
    }
  }

  function createEditorController(name) {
    const documentState = editorDocuments[name]
    return createInputController({
      mode: 'document',
      initialDocumentCells: documentState.cells,
      initialDocumentCursor: documentState.cursor,
      onChange: snapshot => syncEditorValue(name, snapshot)
    })
  }

  const editorControllers = {
    online: createEditorController('online'),
    notes: createEditorController('notes'),
    reader: createEditorController('reader')
  }

  function loadEditorText(name, text, offset = String(text).length) {
    const controller = editorControllers[name]
    if (!controller) return false
    const atoms = editorTextToAtoms(text)
    controller.setDocument(atoms, editorOffsetToCursor(atoms, offset))
    return true
  }
  function setInputSnapshot(snapshot) {
    const clone = atom => Array.isArray(atom)
      ? atom.map(cell => Array.isArray(cell) ? [...cell] : cell)
      : (atom && typeof atom === 'object' ? { ...atom } : atom)
    const document = Array.isArray(snapshot.documentCells)
    state = { ...state, input: document ? {
      confirmedCells: (snapshot.compositionCells || []).map(clone),
      currentDots: [...snapshot.currentDots],
      cursorIndex: snapshot.compositionCursor,
      compositionCells: (snapshot.compositionCells || []).map(clone),
      compositionCursor: snapshot.compositionCursor,
      documentCells: snapshot.documentCells.map(clone),
      documentCursor: snapshot.documentCursor
    } : {
      confirmedCells: snapshot.confirmedCells.map(clone),
      currentDots: [...snapshot.currentDots],
      cursorIndex: snapshot.cursorIndex
    } }
  }

  function resetInput() {
    const controller = activeController()
    if (activeEditorName()) controller.cancelComposition()
    else controller.clear()
    setInputSnapshot(controller.snapshot())
  }

  function onInputCommit(cells) {
    if (state.page === 'learning' && state.learningTab === 'teaching' && state.teaching.item) {
      void commitLearning(cells)
    } else if (state.page === 'experiment' && experiment.snapshot().stage === 'answer') {
      const result = experiment.submit(cells)
      speak(result.correct ? '正确' : `错误，正确答案是 ${experiment.snapshot().trials[experiment.snapshot().index - 1]?.label || ''}`)
    } else if (state.page === 'learning' && state.learningTab === 'input') {
      inputOutput += cellsToUnicode(cells)
    } else if (state.page === 'experiment' && state.experimentTab === 'reader') {
      currentReaderText = appendCommittedBraille(currentReaderText, cells)
    } else if (state.page === 'notes') {
      const textarea = document.querySelector('#note-textarea')
      if (textarea) {
        textarea.value = appendCommittedBraille(textarea.value, cells)
        noteText = textarea.value
        notes.updateReference?.()
      }
    }
  }

  function onAction(event) {
    const target = event.target.closest('[data-action]')
    if (!target) return
    const action = target.dataset.action
    if (TOP_LEVEL_PAGES.includes(action) || action === 'learning' || action === 'experiment' || action === 'notes' || action.startsWith('teaching-') || action === 'experiment-mode' || action === 'experiment-restart') resetInput()
    if (action === 'home') state = { ...state, page: 'home' }
    else if (action === 'learning') state = { ...state, page: 'learning', learningTab: 'teaching' }
    else if (action === 'experiment') state = { ...state, page: 'experiment', experiment: { ...state.experiment, researchMode: state.experiment.researchMode === 'formal' ? 'formal' : 'casual' } }
    else if (action === 'research-entry') { experimentEntryError = ''; state = { ...state, page: 'experiment', experiment: { ...state.experiment, researchMode: 'entry' } } }
    else if (action === 'research-cancel') { experimentEntryError = ''; state = { ...state, experiment: { ...state.experiment, researchMode: 'casual', formalPhase: null } } }
    else if (action === 'research-submit') { beginFormalExperiment() }
    else if (action === 'notes') state = { ...state, page: 'notes' }
    else if (action === 'guide') document.querySelector('.guide-fold')?.setAttribute('open', '')
    else if (action === 'toggle-language') {
      const next = getLang() === 'en' ? 'zh' : 'en'
      setLang(next)
      cancelSpeech()
      render()
    }
    else if (action === 'speak-guide') speak('小键盘七、四、一对应盲文点一、二、三；八、五、二对应点四、五、六。零提交，星号下一方，斜杠上一方，三退格，减号清空，加号朗读，句号空格。')
    else if (action === 'learning-tab') state = { ...state, learningTab: target.dataset.tab }
    else if (action === 'experiment-tab') { experimentToken++; reader.stop(); cancelSpeech(); state = { ...state, experimentTab: target.dataset.tab } }
    else if (action === 'teaching-home') state = { ...state, teaching: { ...state.teaching, category: null, section: null, item: null, tone: null } }
    else if (action === 'teaching-category') state = { ...state, teaching: { ...state.teaching, category: target.dataset.category, section: null, item: null, tone: null } }
    else if (action === 'teaching-continue') {
      const section = target.dataset.section
      const p = sectionProgress(state.teaching.category, section)
      state = { ...state, teaching: { ...state.teaching, section, item: p.current || getTeachingSections(state.teaching.category).find(value => value.id === section).items[0], phase: 'learn', tone: null } }
    } else if (action === 'teaching-tone') {
      const tone = target.dataset.tone || null
      state = { ...state, teaching: { ...state.teaching, tone }, input: { confirmedCells: [], currentDots: [], cursorIndex: 0 } }
    } else if (action === 'teaching-item') state = { ...state, teaching: { ...state.teaching, section: target.dataset.section, item: decodeURIComponent(target.dataset.item), phase: 'learn', tone: null }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-back-section') state = { ...state, teaching: { ...state.teaching, section: null, item: null }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-phase') state = { ...state, teaching: { ...state.teaching, phase: target.dataset.phase }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-prev' || action === 'teaching-next') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const index = section.items.indexOf(state.teaching.item) + (action === 'teaching-prev' ? -1 : 1)
      if (section.items[index]) state = { ...state, teaching: { ...state.teaching, item: section.items[index], tone: null }, input: { confirmedCells: [], currentDots: [] } }
    } else if (action === 'play-item') { const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang(), state.teaching.tone); if (item) { cancelSpeech(); const playback = buildLearningPlayback(item); void playCells(playback.cells) } }
    else if (action === 'mark-learned') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const old = sectionProgress(state.teaching.category, state.teaching.section)
      const next = markTeachingLearned(old, state.teaching.item, section.items)
      saveSectionProgress(state.teaching.category, state.teaching.section, next)
      void progress.markLearned(state.teaching.category, state.teaching.section, state.teaching.item)
      state = { ...state, teaching: { ...state.teaching, item: next.current || state.teaching.item } }
    } else if (action === 'experiment-mode') { experimentToken++; cancelSpeech(); experiment.selectMode(target.dataset.mode); state = { ...state, input: { confirmedCells: [], currentDots: [] } } }
    else if (action === 'experiment-start') {
      const phase = state.experiment.researchMode === 'formal' ? 'formal' : 'casual'
      experiment.start(undefined, { seed: createSessionId('seed'), phase })
      state = { ...state, experiment: { ...state.experiment, formalPhase: phase === 'formal' ? 'recognition' : state.experiment.formalPhase }, input: { confirmedCells: [], currentDots: [] } }
      void playShowcase()
    }
    else if (action === 'research-calibration-pass' || action === 'research-calibration-fail') {
      const passed = action === 'research-calibration-pass'
      experiment.completeCalibration(passed)
      if (!passed) experiment.startTraining()
      state = { ...state, experiment: { ...state.experiment, formalPhase: passed ? 'recognition' : 'training', trainingStarted: true, trainingCompleted: true, calibrationPassed: passed } }
    }
    else if (action === 'experiment-confirm') { experimentToken++; cancelSpeech(); experiment.confirmShowcase(); render() }
    else if (action === 'experiment-listen') {
      const currentState = experiment.snapshot()
      const current = currentState.trials[currentState.index]
      if (current) void playCells(current.cells)
      if (currentState.stage === 'listen') experiment.listen()
      else if (currentState.stage === 'answer') experiment.replay()
      render()
    }
    else if (action === 'experiment-restart') { experiment.restart(); state = { ...state, input: { confirmedCells: [], currentDots: [] } } }
    else if (action === 'reader-play') { readerCompleted = false; readerUnderstood = null; readerSummary = ''; readerTrialRecord = null; readerReplayCount = reader.snapshot().position > 0 ? readerReplayCount + 1 : 0; readerPlayStartedAt = Date.now(); reader.stop(); const playText = state.experiment.researchMode === 'formal' ? selectedReaderPassage.pinyin : (document.querySelector('#reader-text')?.value || SAMPLE_BRAILLE); currentReaderText = playText; void reader.play(playText) }
    else if (action === 'reader-stop') reader.stop()
    else if (action === 'reader-understood') { readerUnderstood = true; if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, selfReportedUnderstood: true }; render() }
    else if (action === 'reader-not-understood') { readerUnderstood = false; if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, selfReportedUnderstood: false }; render() }
    else if (action === 'reader-summary-submit') { readerSummary = document.querySelector('#reader-summary')?.value || ''; if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, summaryText: readerSummary, summarySubmitted: readerSummary.trim().length > 0 }; render() }
    else if (action === 'notes-save') void notes.save()
    else if (action === 'notes-play-text') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('tts') }
    else if (action === 'notes-play-audio') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('braille', Number(document.querySelector('#notes-speed')?.value || 1)) }
    else if (action === 'notes-export') void notes.exportNote('json')
    else if (action === 'notes-import') document.querySelector('#note-import-file')?.click()
    else if (action === 'notes-new') { notes.newNote(); loadEditorText('notes', '') }
    else if (TOP_LEVEL_PAGES.includes(action)) { experimentToken++; reader.stop(); cancelSpeech(); state = { ...state, page: action, input: { confirmedCells: [], currentDots: [] } } }
    render()
  }

  async function playShowcase() {
    const token = ++experimentToken
    // 只播报一次总说明；逐点阶段不再调用 TTS，避免浏览器语音与下一项重叠。
    await speakAndWait(buildShowcaseInstruction(getLang()))
    if (token !== experimentToken) return
    for (const point of buildShowcase()) {
      if (token !== experimentToken) return
      const current = document.querySelector('#showcase-current')
      if (current) current.textContent = point.desc
      await playAudioBraille(point.dots, { duration: 0.55 })
      await new Promise(resolve => setTimeout(resolve, 180))
    }
    const current = document.querySelector('#showcase-current')
    if (current) current.textContent = '展示完成'
  }

  function onKeydown(event) {
    if (!gateOpen) return
    if (event.ctrlKey || event.altKey || event.metaKey) return
    if (event.key === 'F1') { event.preventDefault(); speak('按零提交，星号下一方，斜杠上一方，三退格，减号清空，加号朗读，句号空格。'); return }
    const controller = activeController()
    const point = keyToPoint(event.key)
    if (point !== null) {
      event.preventDefault()
      controller.handleKey(event.key)
      setInputSnapshot(controller.snapshot())
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
    if (event.key === '+' && state.page === 'learning' && state.teaching.item) { const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang(), state.teaching.tone); if (item) void playCells(item.cells) }
    if (event.key === '+' && state.page === 'notes') void notes.readAloud('braille')
    controller.handleKey(event.key)
    setInputSnapshot(controller.snapshot())
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
