// src/app.js —— v9：单一应用壳、四入口、统一事件路由
import './styles.css'
import { createStorage, loadSettings, saveSettings } from './storage.js'
import {
  createAppState,
  TOP_LEVEL_PAGES,
  beginFormalExperiment as beginFormalState,
  acceptConsent,
  saveParticipantProfile,
  completeTraining,
  completeRecognition,
  completeReader,
  setExperimentUploadStatus
} from './app-state.js'
import { createInputController, keyToPoint } from './input.js'
import { createProgressStore } from './curriculum.js'
import { getTeachingCategories, getTeachingSections, getTeachingItems, getTeachingItem, markTeachingLearned, buildItemSpeech } from './teaching.js'
import { createExperimentModel, buildShowcase, buildShowcaseInstruction, buildTrainingRuleText, TRAINING_SINGLE_POINTS, TRAINING_MULTI_EXAMPLES, TRAINING_PRACTICE_TRIALS, TRAINING_CALIBRATION_TRIALS, CALIBRATION_PASS_SCORE } from './experiment.js'
import { createReader, SAMPLE_BRAILLE, buildReaderComprehensionHtml, createReaderTrialRecord } from './reader.js'
import { READER_PASSAGES, sampleReaderPassages, EXPERIENCE_BOOKS, EXPERIENCE_CHAPTERS, getExperienceChapters } from './data/reader-passages.js'
import { initNotes } from './notes.js'
import { playAudioBraille, buildCellSequence, unlockAudio } from './audio-braille.js'
import { speak, speakAndWait, cancelSpeech } from './speech.js'
import { getLang, setLang, t } from './i18n.js'
import {
  validateParticipantProfile,
  deriveCohort,
  STUDY_VERSION,
  PROTOCOL_VERSION,
  CLIENT_VERSION,
  RECOGNITION_BANK_VERSION,
  READER_BANK_VERSION
} from './experiment-protocol.js'
import {
  saveFormalSession,
  saveTrial,
  saveReaderTrial,
  buildUploadBatch,
  markUploadResult,
  exportExperimentData
} from './experiment-data.js'
import { toCells, cellsToUnicode, cellsToDiagram, keyHintForCells } from './cells.js'
import { dotsToUnicode, unicodeToDots } from './braille-engine.js'
import { buildInputDisplayModel } from './input-display.js'
import { createSerialQueue } from './async-queue.js'

export { createAppState }
export function buildPages() { return [...TOP_LEVEL_PAGES] }

export function buildTopNav(lang = 'zh') {
  return [
    { id: 'home', label: lang === 'en' ? 'Home' : '首页' },
    { id: 'learning', label: lang === 'en' ? 'Learn Braille' : '学习盲文' },
    { id: 'experiment', label: lang === 'en' ? 'AudioBraille Lab' : 'AudioBraille 实验' },
    { id: 'reader', label: lang === 'en' ? 'Try Listening' : '体验听书' },
    { id: 'notes', label: lang === 'en' ? 'Notes' : '笔记' }
  ]
}

const FORMAL_TRIAL_COUNTS = Object.freeze({ letters: 20, syllables: 20, symbols: 20, digits: 10 })

export function formalTrialCount(mode) {
  return FORMAL_TRIAL_COUNTS[mode] || 10
}

export function buildHomeActions() {
  return [
    { action: 'learning', icon: '学', label: '学习盲文' },
    { action: 'experiment', icon: '听', label: 'AudioBraille 实验' },
    { action: 'reader', icon: '书', label: '体验听书' },
    { action: 'notes', icon: '记', label: '笔记' }
  ]
}

export function appendSpace(existing = '') {
  return `${existing} `
}

export function buildReaderSpeedHtml({ formal = false, speed = 1 } = {}) {
  if (formal) return '<span class="formal-speed-lock">正式实验固定 1x</span>'
  return `<label class="range-label">速度 <input id="reader-speed" type="range" min="0.5" max="5" step="0.5" value="${speed}"><output>${speed}x</output></label>`
}

export function buildExperienceReaderHtml({ books = [], chapters = [], selectedBookId = '', selectedChapterId = '', speed = 1, completed = false, progressText = '', activeCellIndex = null } = {}) {
  const selectedBook = books.find(book => book.bookId === selectedBookId) || books[0]
  const selectedChapter = chapters.find(chapter => chapter.chapterId === selectedChapterId) || chapters.find(chapter => chapter.bookId === selectedBook?.bookId) || chapters[0]
  const availableChapters = chapters.filter(chapter => chapter.bookId === selectedBook?.bookId)
  const cells = selectedChapter?.brailleCells || []
  const cellHtml = cells.map((cell, index) => `<span class="braille-playback-cell${index === activeCellIndex ? ' is-playing' : ''}" data-cell-index="${index}" aria-label="盲文第 ${index + 1} 方">${esc(dotsToUnicode(cell))}</span>`).join('')
  return `<section class="page page-reader"><div class="page-heading"><div><p class="eyebrow">LISTENING ROOM</p><h1>体验听书</h1></div></div><p class="lead">选择一本小书和章节，对照明文与盲文，体验 AudioBraille 的逐方播放。</p><div class="reader-library-picker"><label>书籍<select id="experience-book" data-field="experience-book">${books.map(book => `<option value="${esc(book.bookId)}"${book.bookId === selectedBook?.bookId ? ' selected' : ''}>${esc(book.title)}</option>`).join('')}</select></label><label>章节<select id="experience-chapter" data-field="experience-chapter">${availableChapters.map(chapter => `<option value="${esc(chapter.chapterId)}"${chapter.chapterId === selectedChapter?.chapterId ? ' selected' : ''}>${esc(chapter.title)}</option>`).join('')}</select></label></div>${selectedChapter ? `<p class="reader-passage-meta">${esc(selectedChapter.bookTitle)} · ${esc(selectedChapter.title)} · ${cells.length} 方</p><div class="reader-comparison"><article class="reader-text-column"><h2>明文</h2><p>${esc(selectedChapter.text)}</p></article><article class="reader-braille-column"><h2>盲文对照</h2><div class="braille-playback" id="experience-braille" aria-label="盲文对照">${cellHtml}</div></article></div>` : '<p class="empty-state">暂无可用章节。</p>'}<div class="reader-controls"><button class="button button-primary" data-action="reader-play">播放 AudioBraille</button><button class="button button-quiet" data-action="reader-pause">暂停</button><button class="button button-quiet" data-action="reader-resume">继续</button><button class="button button-quiet" data-action="reader-stop">停止</button>${buildReaderSpeedHtml({ speed })}</div><p id="reader-progress" aria-live="polite">${esc(progressText || (completed ? '本章播放完成。' : '尚未播放'))}</p><p class="reader-casual-note">这是独立体验功能，不需要进入正式实验，也不会产生正式实验结果。</p></section>`
}

export function buildFormalUploadStatusHtml(status = 'idle') {
  const labels = { idle: '尚未上传', pending: '等待上传', success: '上传成功', error: '上传失败，已保存在本机' }
  return `<section class="formal-upload-status"><strong>${labels[status] || labels.idle}</strong><div class="button-row"><button class="button button-primary" data-action="experiment-upload">上传正式实验数据</button><button class="button button-quiet" data-action="experiment-export-json">导出实验数据 JSON</button><button class="button button-quiet" data-action="experiment-export-csv">导出实验数据 CSV</button></div></section>`
}

function formalBase({ sessionId, participantId = null, profile = {}, randomSeed = null, startedAt = null, completedAt = null, qualityFlags = [], analysisEligibility = 'incomplete' } = {}) {
  return {
    sessionId,
    participantId,
    studyVersion: STUDY_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    clientVersion: CLIENT_VERSION,
    recognitionBankVersion: RECOGNITION_BANK_VERSION,
    readerBankVersion: READER_BANK_VERSION,
    dataClass: 'formal',
    consentAccepted: true,
    cohort: deriveCohort(profile),
    profile: {
      visionStatus: profile.visionStatus,
      brailleExperience: profile.brailleExperience,
      audioEncodingExperience: profile.audioEncodingExperience
    },
    randomSeed,
    startedAt,
    completedAt,
    qualityFlags: [...qualityFlags],
    analysisEligibility
  }
}

export function buildFormalSessionRecord(options = {}) {
  return formalBase(options)
}

export function buildFormalRecognitionRecord({ sessionId, record = {}, analysisEligibility = 'incomplete' } = {}) {
  return {
    ...record,
    eventId: record.eventId || record.trialId,
    sessionId,
    dataClass: 'formal',
    phase: 'formal',
    studyVersion: record.studyVersion || STUDY_VERSION,
    protocolVersion: record.protocolVersion || PROTOCOL_VERSION,
    clientVersion: record.clientVersion || CLIENT_VERSION,
    bankVersion: record.bankVersion || RECOGNITION_BANK_VERSION,
    recognitionBankVersion: record.recognitionBankVersion || RECOGNITION_BANK_VERSION,
    readerBankVersion: record.readerBankVersion || READER_BANK_VERSION,
    analysisEligibility
  }
}

export function buildFormalTrainingRecord({ sessionId, record = {}, analysisEligibility = 'incomplete' } = {}) {
  return {
    ...record,
    eventId: record.eventId || record.trialId,
    sessionId,
    dataClass: 'training',
    phase: 'training',
    studyVersion: record.studyVersion || STUDY_VERSION,
    protocolVersion: record.protocolVersion || PROTOCOL_VERSION,
    clientVersion: record.clientVersion || CLIENT_VERSION,
    analysisEligibility
  }
}

export function buildFormalReaderRecord({ sessionId, record = {}, analysisEligibility = 'incomplete' } = {}) {
  return {
    ...record,
    eventId: record.eventId || record.passageTrialId,
    sessionId,
    dataClass: 'formal',
    phase: 'formal',
    studyVersion: record.studyVersion || STUDY_VERSION,
    protocolVersion: record.protocolVersion || PROTOCOL_VERSION,
    clientVersion: record.clientVersion || CLIENT_VERSION,
    passageVersion: record.passageVersion || READER_BANK_VERSION,
    readerBankVersion: record.readerBankVersion || READER_BANK_VERSION,
    recognitionBankVersion: record.recognitionBankVersion || RECOGNITION_BANK_VERSION,
    analysisEligibility
  }
}
export function buildFormalConsentHtml() {
  return '<section class="research-entry"><h2>正式实验：研究说明与同意</h2><p>本实验收集匿名的听觉辨识和听书体验数据，用于研究 AudioBraille 的可用性。你可以随时停止；不同意上传时仍可导出并保留在本机。</p><label><input type="checkbox" data-field="consent"> 我同意匿名实验数据用于研究</label><button class="button button-primary" data-action="research-submit">同意并继续</button></section>'
}

export function buildFormalProfileHtml() {
  return '<section class="research-entry"><h2>正式实验：参与者背景</h2><p>以下字段只用于分层分析，可以选择“不愿回答”。</p><label>视力状态<select data-field="visionStatus"><option value="sighted">明眼</option><option value="low-vision">低视力</option><option value="blind">盲人</option><option value="undisclosed">不愿回答</option></select></label><label>盲文经验<select data-field="brailleExperience"><option value="none">没有盲文经验</option><option value="beginner">初学盲文</option><option value="experienced">熟悉盲文</option><option value="undisclosed">不愿回答</option></select></label><label>AudioBraille 经验<select data-field="audioEncodingExperience"><option value="none">没有 AudioBraille 经验</option><option value="some">接触过类似听觉编码</option><option value="audiobraille-trained">完成过 AudioBraille 训练</option><option value="undisclosed">不愿回答</option></select></label><button class="button button-primary" data-action="research-profile-submit">保存背景并进入训练</button></section>'
}

export function buildFormalCompleteHtml(status = 'idle') {
  return `<section class="formal-complete"><h2>正式实验已完成</h2><p>正式辨识和三段听书记录已保存在本机。你可以主动上传，或导出后交给研究者。</p>${buildFormalUploadStatusHtml(status)}</section>`
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

export function buildExamReferenceMaskHtml() {
  return '<div class="lesson-reference-mask"><button class="button button-quiet" data-action="teaching-show-reference" aria-label="查看教学参考">查看</button></div>'
}

export function buildLearningPlayback(item) {
  return { cells: item?.cells || [], speech: null }
}

export function buildFormalTrainingHtml(model = {}) {
  const step = model.trainingStep || 'rules'
  const labels = {
    rules: '完整规则',
    'single-points': '六个单点',
    'multi-examples': '多点示例',
    practice: '不计分练习',
    calibration: '固定校准'
  }
  const steps = ['rules', 'single-points', 'multi-examples', 'practice', 'calibration']
  const progress = `<ol class="training-steps" aria-label="训练进度">${steps.map(item => `<li class="${item === step ? 'is-current' : steps.indexOf(item) < steps.indexOf(step) ? 'is-done' : ''}">${labels[item]}</li>`).join('')}</ol>`
  const inputConfirmedCells = model.inputConfirmedCells || []
  const inputCurrentDots = model.inputCurrentDots || []
  const inputCursorIndex = model.inputCursorIndex ?? 0
  const trainingExamples = step === 'single-points' ? TRAINING_SINGLE_POINTS.map(dots => [dots]) : step === 'multi-examples' ? TRAINING_MULTI_EXAMPLES.flat() : []
  const trainingExample = trainingExamples.length ? `<div class="training-showcase"><h3>本阶段盲文示例</h3><div id="training-showcase-braille" class="braille-playback" aria-label="训练盲文示例">${diagramHtml(trainingExamples)}</div></div>` : ''
  const trainingInput = step === 'rules' || step === 'complete' ? '' : `<div class="training-input-panel"><h3>训练输入</h3>${inputDisplayHtml(inputConfirmedCells, inputCurrentDots, inputCursorIndex, '训练输入盲文点位')}<p class="training-input-note">${step === 'single-points' || step === 'multi-examples' ? '可以跟着声音试着输入；本阶段仅用于熟悉操作，不计分。' : model.trainingQuestionStarted ? '已播放本题，可以输入听到的盲文方，按 0 提交。' : '请先播放本题，播放完成后才能输入并提交。'}</p></div>`
  let body = ''
  if (step === 'complete') {
    body = model.calibrationPassed ? `<p>校准通过，正在进入正式辨识。</p>` : `<p>本次校准得分 ${model.trainingCalibrationScore || 0} / ${(model.trainingCalibrationTrials || []).length}，未达到通过标准。请重新完成统一训练和校准。</p><button class="button button-primary" data-action="training-restart">重新训练和校准</button>`
  } else if (step === 'rules') {
    body = `<p>先听完整规则说明。播放结束后自动进入下一步。</p><button class="button button-primary" data-action="training-play-rules">播放完整规则</button>`
  } else if (step === 'single-points') {
    body = `<p>按顺序播放点 1 至点 6 的单点声音，帮助你建立左右声道和音高对应关系。</p><button class="button button-primary" data-action="training-play-single">播放六个单点</button><p id="training-showcase-current" class="training-current" aria-live="polite">准备播放</p>`
  } else if (step === 'multi-examples') {
    body = `<p>播放固定的多点方示例，熟悉同一方中同时响起的和弦。</p><button class="button button-primary" data-action="training-play-multi">播放多点示例</button><p id="training-showcase-current" class="training-current" aria-live="polite">准备播放</p>`
  } else if (step === 'practice') {
    const trials = model.trainingPracticeTrials || []
    const trial = trials[model.trainingQuestionIndex || 0]
    const played = model.trainingQuestionStarted === true
    body = `<p>这是不计入正式结果的练习。先播放本题，再输入听到的盲文方，按 0 提交。</p><p><strong>练习题 ${Math.min((model.trainingQuestionIndex || 0) + 1, trials.length)} / ${trials.length}</strong></p><button class="button button-primary" data-action="training-listen-question" ${played || !trial ? 'disabled' : ''}>${played ? '已播放，请输入' : '播放本题'}</button><div class="input-preview" id="training-input-preview">${played ? '请用小键盘输入盲文，按 0 提交。' : '请先播放本题。'}</div>`
  } else if (step === 'calibration') {
    const trials = model.trainingCalibrationTrials || []
    const trial = trials[model.trainingQuestionIndex || 0]
    const played = model.trainingQuestionStarted === true
    body = `<p>固定校准题用于确认你是否已经掌握 AudioBraille 编码。答对至少 ${CALIBRATION_PASS_SCORE} / ${trials.length} 题才可进入正式辨识。</p><p><strong>校准题 ${Math.min((model.trainingQuestionIndex || 0) + 1, trials.length)} / ${trials.length}</strong></p><button class="button button-primary" data-action="training-listen-question" ${played || !trial ? 'disabled' : ''}>${played ? '已播放，请输入' : '播放本题'}</button><div class="input-preview" id="training-input-preview">${played ? '请用小键盘输入盲文，按 0 提交。' : '请先播放本题。'}</div>`
  }
  return `<section class="experiment-status training-panel"><h2>统一训练和校准</h2><p>训练数据只用于训练质量记录，不计入正式辨识结果。</p>${progress}${model.feedback ? `<p class="training-feedback" role="status">${esc(model.feedback)}</p>` : ''}<div class="training-step-content">${body}${trainingExample}${trainingInput}</div></section>`
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
  return `<span class="braille-diagram" aria-label="盲文 ${esc(cellsToUnicode(cells))}">${cellsToDiagram(cells).map((cell, cellIndex) => {
    const order = [0, 3, 1, 4, 2, 5]
    return `<span class="braille-cell" data-cell-index="${cellIndex}">${order.map(index => `<i class="braille-dot${cell.dots[index] ? ' is-on' : ''}"></i>`).join('')}</span>`
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
    },
    onPlaybackCellStart: index => setPlaybackHighlight('#note-reference', index),
    onPlaybackCellComplete: () => clearPlaybackHighlight('#note-reference')
  })
  let selectedReaderPassage = READER_PASSAGES[0]
  let readerPassages = READER_PASSAGES
  let readerCompleted = false
  let readerUnderstood = null
  let readerSummary = ''
  let readerTrialRecord = null
  let readerPlayStartedAt = null
  let readerReplayCount = 0
  let readerPlayToken = 0
  let activeReaderGeneration = null
  const reader = createReader({ onTick: (position, total) => {
    const el = document.querySelector('#reader-progress')
    if (el) el.textContent = `${position} / ${total}`
  }, onComplete: ({ generation } = {}) => {
    if (generation !== activeReaderGeneration) return
    readerCompleted = true
    readerTrialRecord = createReaderTrialRecord({
      passageId: selectedReaderPassage.passageId,
      passageVersion: selectedReaderPassage.passageVersion,
      passageIndex: readerPassages.findIndex(passage => passage.passageId === selectedReaderPassage.passageId),
      playStartedAt: readerPlayStartedAt,
      playCompletedAt: Date.now(),
      playedDurationMs: readerPlayStartedAt ? Date.now() - readerPlayStartedAt : null,
      completed: true,
      pauseCount: reader.snapshot().pauseCount,
      replayCount: readerReplayCount,
      playbackSpeed: reader.getSpeed()
    })
    render()
  }, onCellStart: (index) => { if (state.page === 'reader') setPlaybackHighlight('#experience-braille', index) }, onCellComplete: () => { if (state.page === 'reader') clearPlaybackHighlight('#experience-braille') } })
  let experiment = createExperimentModel({ trialCount: 10 })
  let noteText = ''
  let inputOutput = ''
  let progressCache = {}
  let currentReaderText = SAMPLE_BRAILLE
  let selectedExperienceBookId = EXPERIENCE_BOOKS[0]?.bookId || ''
  let selectedExperienceChapterId = EXPERIENCE_CHAPTERS[0]?.chapterId || ''
  const readerAtoms = editorTextToAtoms(SAMPLE_BRAILLE)
  const editorDocuments = {
    online: { cells: [], cursor: 0 },
    notes: { cells: [], cursor: 0 },
    reader: { cells: readerAtoms, cursor: readerAtoms.length }
  }
  let experimentToken = 0
  let gateOpen = false
  let experimentEntryError = ''
  let formalSession = null
  let formalSessionSeed = null
  let formalRecognitionIndex = 0
  let formalReaderIndex = 0
  const formalRecognitionModes = ['letters', 'syllables', 'symbols', 'digits']
  let readerSummaryConfirmed = false
  let readerFinalizing = false
  let formalPersistenceFailed = false
  let trainingPlaybackBusy = false
  let trainingFeedback = ''
  const formalPersistenceQueue = createSerialQueue()


  function createSessionId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  async function saveCurrentFormalSession(overrides = {}) {
    if (!formalSession) return false
    const snapshot = { ...formalSession, ...overrides }
    formalSession = snapshot
    try {
      await formalPersistenceQueue.enqueue(() => saveFormalSession(storage, snapshot))
      return true
    } catch (error) {
      formalPersistenceFailed = true
      experimentEntryError = error.message || '正式实验记录保存失败。'
      return false
    }
  }

  async function persistTrainingRecord(record) {
    if (state.experiment.researchMode !== 'formal' || !record || !formalSession) return false
    const event = buildFormalTrainingRecord({
      sessionId: formalSession.sessionId,
      record,
      analysisEligibility: formalSession.analysisEligibility
    })
    try {
      await formalPersistenceQueue.enqueue(() => saveTrial(storage, event))
      return true
    } catch (error) {
      formalPersistenceFailed = true
      experimentEntryError = error.message || '训练记录保存失败。'
      return false
    }
  }

  async function persistRecognitionRecord(record) {
    if (state.experiment.researchMode !== 'formal' || !record || !formalSession) return false
    const event = buildFormalRecognitionRecord({
      sessionId: formalSession.sessionId,
      record,
      analysisEligibility: formalSession.analysisEligibility
    })
    try {
      await formalPersistenceQueue.enqueue(() => saveTrial(storage, event))
      return true
    } catch (error) {
      formalPersistenceFailed = true
      experimentEntryError = error.message || '正式辨识记录保存失败。'
      return false
    }
  }

  async function persistReaderRecord(record) {
    if (state.experiment.researchMode !== 'formal' || !record || !formalSession) return false
    const event = buildFormalReaderRecord({
      sessionId: formalSession.sessionId,
      record,
      analysisEligibility: formalSession.analysisEligibility
    })
    try {
      await formalPersistenceQueue.enqueue(() => saveReaderTrial(storage, event))
      return true
    } catch (error) {
      formalPersistenceFailed = true
      experimentEntryError = error.message || '正式听书记录保存失败。'
      return false
    }
  }

  async function uploadFormalData() {
    state = setExperimentUploadStatus(state, 'pending')
    render()
    let batch = null
    try {
      await formalPersistenceQueue.idle()
      if (formalPersistenceFailed) throw new Error('正式实验记录保存失败，请检查本机存储后重试。')
      batch = await buildUploadBatch(storage)
      if (!batch.sessions.length) throw new Error('没有等待上传的正式实验数据。')
      const response = await fetch('/api/experiment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch)
      })
      if (!response.ok) throw new Error(`上传失败（${response.status}）`)
      await markUploadResult(storage, batch, { ok: true })
      state = setExperimentUploadStatus(state, 'success')
    } catch (error) {
      if (batch) await markUploadResult(storage, batch, { ok: false, error: error.message })
      state = setExperimentUploadStatus(state, 'error')
      experimentEntryError = error.message || '上传失败，数据已保存在本机。'
    }
    render()
  }

  async function exportFormalData(format) {
    const content = await exportExperimentData(storage, format)
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audiobraille-experiment-${Date.now()}.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  function enterFormalExperiment() {
    const participantId = createSessionId('participant')
    const sessionId = createSessionId('session')
    formalSessionSeed = createSessionId('seed')
    formalRecognitionIndex = 0
    formalReaderIndex = 0
    readerSummaryConfirmed = false
    formalSession = null
    formalPersistenceFailed = false
    readerPassages = sampleReaderPassages(READER_PASSAGES, 3, sessionId)
    reader.setSpeed(1)
    selectedReaderPassage = readerPassages[0]
    experimentEntryError = ''
    state = beginFormalState(state, { participantId, sessionId })
    state = { ...state, page: 'experiment', experimentTab: 'recognition' }
    return true
  }

  function acceptFormalConsent() {
    if (document.querySelector('[data-field="consent"]')?.checked !== true) {
      experimentEntryError = '开始正式实验前，请先同意匿名数据用于研究。'
      return false
    }
    state = acceptConsent(state)
    experimentEntryError = ''
    return true
  }

  function createFormalRecognitionModel(mode) {
    return createExperimentModel({
      trialCount: formalTrialCount(mode),
      dataClass: 'formal',
      studyVersion: STUDY_VERSION,
      consentAccepted: true,
      participantId: state.experiment.participantId,
      sessionId: state.experiment.sessionId
    })
  }

  async function submitFormalProfile() {
    const profile = {
      visionStatus: document.querySelector('[data-field="visionStatus"]')?.value,
      brailleExperience: document.querySelector('[data-field="brailleExperience"]')?.value,
      audioEncodingExperience: document.querySelector('[data-field="audioEncodingExperience"]')?.value
    }
    if (!validateParticipantProfile(profile).valid) {
      experimentEntryError = '请完成参与者背景字段。'
      return false
    }
    state = saveParticipantProfile(state, profile)
    formalSession = buildFormalSessionRecord({
      participantId: state.experiment.participantId,
      sessionId: state.experiment.sessionId,
      profile,
      randomSeed: formalSessionSeed,
      startedAt: new Date().toISOString(),
      qualityFlags: [],
      analysisEligibility: 'incomplete'
    })
    experiment = createFormalRecognitionModel(formalRecognitionModes[formalRecognitionIndex])
    experiment.startTraining()
    experimentEntryError = ''
    await saveCurrentFormalSession()
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
      <div class="home-actions">${buildHomeActions().map(item => `<button class="home-action" data-action="${item.action}"><span class="action-icon">${item.icon}</span><span>${item.label}</span><small>${item.action === 'experiment' ? '听觉辨识与正式听书场景' : item.action === 'reader' ? '选择章节，对照明文与盲文听一段书' : item.action === 'learning' ? '从字母、拼音到数字和符号' : '记录、导入、导出与朗读'}</small></button>`).join('')}</div>
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
    const referenceHidden = teaching.phase === 'exam' && teaching.examReferenceVisible !== true
    const referenceAttrs = referenceHidden ? ' aria-hidden="true"' : ''
    const referenceClass = referenceHidden ? ' is-exam-concealed' : ''
    return `<div class="subhead"><button class="button button-quiet" data-action="teaching-back-section">← ${esc(section?.label || '列表')}</button><span class="item-position">${index + 1} / ${items.length}</span></div>
      <div class="lesson-layout${referenceClass}">
        <div class="lesson-summary"${referenceAttrs}><p class="eyebrow">${esc(item.type)}</p><h2>${esc(item.label)}</h2><p class="lesson-note">${item.type === 'initial' ? '声母' : item.type === 'final' ? '韵母' : item.type === 'syllable' ? `音节${item.toneName ? ` · ${item.toneName}` : ''}` : ''}</p></div>
        <div class="lesson-braille"${referenceAttrs}><div class="lesson-unicode">${esc(item.unicode)}</div>${diagramHtml(item.cells)}<p>点位：${esc(pointsText(item.cells))}</p><p>键位：<strong>${esc(keyHintForCells(item.cells))}</strong></p>${item.type === 'syllable' ? `<div class="syllable-tone-picker">${buildTonePickerHtml(teaching.tone)}<p class="tone-status">${item.toneName || '无调'} · ${item.cells.length}方${teaching.tone && item.cells.length < 3 ? ' · 按国家通用盲文规则省写' : ''}</p></div>` : ''}</div>
        <div class="lesson-actions"${referenceAttrs}><button class="button button-primary" data-action="play-item">播放 AudioBraille</button><button class="button button-success" data-action="mark-learned">标记为已学</button></div>
        ${referenceHidden ? buildExamReferenceMaskHtml() : ''}
      </div>
      <div class="phase-tabs"><button class="tab${teaching.phase === 'learn' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="learn">学</button><button class="tab${teaching.phase === 'practice' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="practice">练</button><button class="tab${teaching.phase === 'exam' ? ' is-active' : ''}" data-action="teaching-phase" data-phase="exam">考</button></div>
      <div class="phase-panel">${practice ? `<p>${teaching.phase === 'practice' ? '请根据上方提示输入，按 0 提交。' : '上方教学内容已隐藏。请输入这个项目的盲文，按 0 提交；需要核对时可点击“查看”。'}</p><div class="input-preview" id="learning-input-preview">${inputDisplayHtml(state.input.confirmedCells, state.input.currentDots, state.input.cursorIndex, '学习输入')}</div>` : `<p>${esc(buildItemSpeech(item, getLang()))}</p>`}</div>
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
    const heading = '<div class="page-heading"><div><p class="eyebrow">AUDIOBRAILLE LAB</p><h1>AudioBraille 实验</h1></div></div>'
    if (state.experiment.researchMode === 'formal') {
      if (state.experiment.formalPhase === 'consent') {
        return `<section class="page page-experiment">${heading}<button class="button button-quiet" data-action="research-cancel">返回试玩实验</button>${buildFormalConsentHtml()}${experimentEntryError ? `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>` : ''}</section>`
      }
      if (state.experiment.formalPhase === 'profile') {
        return `<section class="page page-experiment">${heading}<button class="button button-quiet" data-action="research-cancel">返回试玩实验</button>${buildFormalProfileHtml()}${experimentEntryError ? `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>` : ''}</section>`
      }
      if (state.experiment.formalPhase === 'complete') {
        return `<section class="page page-experiment">${heading}${buildFormalCompleteHtml(state.experiment.uploadStatus)}${experimentEntryError ? `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>` : ''}</section>`
      }
    }
    return `<section class="page page-experiment">${heading}<p class="lead">测试一种通过空间音频聆听盲文的新途径。</p><div class="tabs"><button class="tab${state.experimentTab === 'recognition' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="recognition">听觉辨识</button><button class="tab${state.experimentTab === 'reader' ? ' is-active' : ''}" data-action="experiment-tab" data-tab="reader">听书场景</button></div>${state.experimentTab === 'recognition' ? renderRecognition(model) : renderReader()}</section>`
  }

  function renderRecognition(model) {
    const modes = [['letters', '字母'], ['syllables', '拼音音节'], ['symbols', '符号'], ['digits', '数字']]
    const formal = state.experiment.researchMode === 'formal'
    const activeMode = formalRecognitionModes[formalRecognitionIndex]
    let body = formal
      ? `<p>正式辨识按固定顺序完成四类模式：第 ${formalRecognitionIndex + 1} / ${formalRecognitionModes.length} 类（${modes.find(([id]) => id === activeMode)?.[1] || activeMode}）。</p><div class="mode-picker"><span class="mode-chip is-active">${modes.find(([id]) => id === activeMode)?.[1] || activeMode}</span></div>`
      : `<p>选择试玩或进入正式实验。正式实验会先完成统一训练和校准。</p><div class="mode-picker">${modes.map(([id, label]) => `<button class="mode-chip${model.mode === id ? ' is-active' : ''}" data-action="experiment-mode" data-mode="${id}">${label}</button>`).join('')}</div>`
    if (model.stage === 'idle') {
      if (formal && state.experiment.formalPhase === 'recognition') body += `<button class="button button-primary" data-action="experiment-start">开始正式辨识</button>`
      else if (!formal) body += `<button class="button button-primary" data-action="experiment-start">开始试玩一轮</button><button class="button button-secondary" data-action="research-entry">进入正式实验</button>`
    }
    if (formal && state.experiment.formalPhase === 'training') body = buildFormalTrainingHtml({ ...model, feedback: trainingFeedback, inputConfirmedCells: state.input.confirmedCells, inputCurrentDots: state.input.currentDots, inputCursorIndex: state.input.cursorIndex })
    if (model.stage === 'showcase') body += `<div class="experiment-status"><strong>展示阶段</strong><p>先听一次完整说明，随后依次播放六个声音。当前：<span id="showcase-current">准备开始</span></p><button class="button button-primary" data-action="experiment-confirm">我已听完展示，进入测试</button></div>`
    if (model.stage === 'listen' || model.stage === 'answer') {
      const trial = model.trials[model.index]
      body += `<div class="experiment-status"><strong>第 ${model.index + 1} / ${model.trials.length} 题</strong><p>${model.stage === 'listen' ? '按 0 或点击按钮听音频。' : '输入听到的盲文方，按 0 提交。'}</p><button class="button button-primary" data-action="experiment-listen">${model.stage === 'listen' ? '播放本题音频' : '重听本题'}</button>${inputDisplayHtml(state.input.confirmedCells, state.input.currentDots, state.input.cursorIndex, '实验输入盲文点位')}</div>`
      if (trial) body += `<p class="sr-only">本题需要 ${trial.cells.length} 方</p>`
    }
    if (model.stage === 'done') {
      if (formal && formalRecognitionIndex < formalRecognitionModes.length - 1) body += `<div class="experiment-status"><h2>本类完成</h2><p>正确 ${model.results.filter(result => result.correct).length} / ${model.results.length}</p><button class="button button-primary" data-action="experiment-next-formal-mode">进入下一类</button></div>`
      else if (formal) body += `<div class="experiment-status"><h2>四类辨识完成</h2><p>正式辨识记录已保存，接下来进入听书。</p><button class="button button-primary" data-action="experiment-finish-recognition">进入听书</button></div>`
      else body += `<div class="experiment-status"><h2>本轮完成</h2><p>正确 ${model.results.filter(result => result.correct).length} / ${model.results.length}</p><button class="button button-primary" data-action="experiment-restart">再来一轮</button></div>`
    }
    if (model.blocked) body += `<p class="form-error" role="alert">正式实验需要先完成同意和身份字段。</p>`
    if (experimentEntryError) body += `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>`
    return `<div class="experiment-panel">${body}</div>`
  }

  function renderReader() {
    if (state.experiment.researchMode === 'formal' && state.experiment.formalPhase !== 'reader') return `<div class="reader-panel"><h2>听书场景</h2><p>完成统一训练、校准和听觉辨识后，才能进入正式听书。</p></div>`
    const input = state.input
    const composition = input.compositionCells || input.confirmedCells
    const compositionCursor = input.compositionCursor ?? input.cursorIndex
    const formalReader = state.experiment.researchMode === 'formal'
    return `<div class="reader-panel"><h2>听书场景</h2><p>播放当前材料，完成后再填写理解反馈。</p>${formalReader ? `<p class="reader-passage-meta">第 ${formalReaderIndex + 1} / ${readerPassages.length} 段材料 · ${esc(selectedReaderPassage.topicStratum)} · ${esc(selectedReaderPassage.difficultyStratum)}</p>` : ''}<div class="reader-input-preview">${inputDisplayHtml(composition, input.currentDots, compositionCursor, '当前多方输入')}</div>${formalReader ? '' : buildTextareaDocumentHtml(currentReaderText, { id: 'reader-text', rows: 4, label: '盲文内容' })}${buildReaderSpeedHtml({ formal: formalReader, speed: formalReader ? 1 : reader.getSpeed() })}<div class="button-row"><button class="button button-primary" data-action="reader-play">播放 AudioBraille</button><button class="button button-quiet" data-action="reader-pause">暂停</button><button class="button button-quiet" data-action="reader-resume">继续</button><button class="button button-quiet" data-action="reader-stop">停止</button></div><div id="reader-progress" aria-live="polite"></div>${buildReaderComprehensionHtml({ completed: readerCompleted, understood: readerUnderstood, summaryText: readerSummary })}${experimentEntryError ? `<p class="form-error" role="alert">${esc(experimentEntryError)}</p>` : ""}</div>`
  }

  function renderExperienceReader() {
    const chapters = getExperienceChapters(selectedExperienceBookId)
    const chapter = chapters.find(item => item.chapterId === selectedExperienceChapterId) || chapters[0] || EXPERIENCE_CHAPTERS[0]
    if (chapter && chapter.chapterId !== selectedExperienceChapterId) selectedExperienceChapterId = chapter.chapterId
    return buildExperienceReaderHtml({
      books: EXPERIENCE_BOOKS,
      chapters: EXPERIENCE_CHAPTERS,
      selectedBookId: selectedExperienceBookId,
      selectedChapterId: chapter?.chapterId || selectedExperienceChapterId,
      speed: reader.getSpeed(),
      completed: readerCompleted,
      progressText: document.querySelector('#reader-progress')?.textContent || ''
    })
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
    let html = state.page === 'home' ? renderHome() : state.page === 'learning' ? renderLearning() : state.page === 'experiment' ? renderExperiment() : state.page === 'reader' ? renderExperienceReader() : renderNotes()
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
    const experienceBook = document.querySelector('#experience-book')
    experienceBook?.addEventListener('change', () => {
      selectedExperienceBookId = experienceBook.value
      selectedExperienceChapterId = getExperienceChapters(selectedExperienceBookId)[0]?.chapterId || ''
      reader.stop()
      readerPlayToken += 1
      readerCompleted = false
      activeReaderGeneration = null
      render()
    })
    const experienceChapter = document.querySelector('#experience-chapter')
    experienceChapter?.addEventListener('change', () => {
      selectedExperienceChapterId = experienceChapter.value
      reader.stop()
      readerPlayToken += 1
      readerCompleted = false
      activeReaderGeneration = null
      render()
    })
    const readerPassage = document.querySelector('#reader-passage')
    readerPassage?.addEventListener('change', () => {
      activeReaderGeneration = null
      reader.stop()
      readerPlayToken += 1
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

  function setPlaybackHighlight(selector, index) {
    document.querySelectorAll('.is-playing').forEach(element => element.classList.remove('is-playing'))
    if (selector == null || index == null) return
    const element = document.querySelector(selector + ' [data-cell-index="' + index + '"]')
    element?.classList.add('is-playing')
  }

  function clearPlaybackHighlight(selector = null) {
    const elements = selector ? document.querySelectorAll(selector + ' .is-playing') : document.querySelectorAll('.is-playing')
    elements.forEach(element => element.classList.remove('is-playing'))
  }

  async function playCells(cells, targetSelector = null) {
    const token = ++experimentToken
    try {
      for (const [index, cell] of buildCellSequence(cells).entries()) {
        if (token !== experimentToken) return false
        setPlaybackHighlight(targetSelector, index)
        await playAudioBraille(cell, { duration: 0.35 })
        if (token !== experimentToken) return false
        await new Promise(resolve => setTimeout(resolve, 120))
      }
      return true
    } finally {
      if (token === experimentToken) clearPlaybackHighlight(targetSelector)
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
        reader.stop()
        readerPlayToken += 1
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
    } else if (state.page === 'experiment' && state.experimentTab === 'recognition' && experiment.snapshot().stage === 'training' && ['practice', 'calibration'].includes(experiment.snapshot().trainingStep)) {
      const before = experiment.snapshot()
      const trials = before.trainingStep === 'practice' ? before.trainingPracticeTrials : before.trainingCalibrationTrials
      const trial = trials[before.trainingQuestionIndex]
      const result = experiment.submitTrainingAnswer(cells)
      if (!result.reason && result.record) void persistTrainingRecord(result.record)
      if (result.reason) {
        trainingFeedback = result.reason === 'training-question-not-played' ? '请先播放本题，再输入盲文。' : '当前还不能提交。'
      } else {
        trainingFeedback = result.correct ? '正确。' : '这道训练题不正确，请继续下一题。'
        if (result.finished) {
          state = completeTraining(state, { passed: result.passed })
          void saveCurrentFormalSession({
            trainingStarted: true,
            trainingCompleted: result.passed,
            calibrationPassed: result.passed,
            calibrationAttempts: state.experiment.calibrationAttempts,
            qualityFlags: state.experiment.qualityFlags,
            analysisEligibility: result.passed ? 'incomplete' : 'calibration-failed'
          })
          trainingFeedback = result.passed
            ? `校准通过（${result.score} / ${before.trainingCalibrationTrials.length}），可以进入正式辨识。`
            : `校准未通过（${result.score} / ${before.trainingCalibrationTrials.length}），请重新训练和校准。`
        }
      }
      render()
    } else if (state.page === 'experiment' && state.experimentTab === 'recognition' && experiment.snapshot().stage === 'answer') {
      const result = experiment.submit(cells)
      if (state.experiment.researchMode === 'formal') {
        const savePromise = persistRecognitionRecord(result.record)
        void savePromise.then(saved => {
          if (saved && result.state?.stage === 'done') {
            const completedModes = [...new Set([...state.experiment.formalRecognitionModesCompleted, result.record.mode])]
            state = { ...state, experiment: { ...state.experiment, formalRecognitionModesCompleted: completedModes } }
          }
          render()
        })
      }
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

  async function finalizeFormalReaderTrial(understood, summaryText = '') {
    if (state.experiment.researchMode !== 'formal' || !readerTrialRecord || !formalSession || readerFinalizing) return
    readerFinalizing = true
    try {
      const summary = typeof summaryText === 'string' ? summaryText : ''
      const record = {
        ...readerTrialRecord,
        selfReportedUnderstood: Boolean(understood),
        summaryText: understood === true ? summary : '',
        summarySubmitted: understood === true && summary.trim().length > 0
      }
      const saved = await persistReaderRecord(record)
      if (!saved) {
        render()
        return
      }
      formalReaderIndex += 1
      readerSummaryConfirmed = true
      if (formalReaderIndex >= readerPassages.length) {
        state = completeReader(state, formalReaderIndex)
        await saveCurrentFormalSession({
          completedAt: new Date().toISOString(),
          analysisEligibility: 'eligible',
          qualityFlags: state.experiment.qualityFlags
        })
      } else {
        selectedReaderPassage = readerPassages[formalReaderIndex]
        readerCompleted = false
        readerUnderstood = null
        readerSummary = ''
        readerTrialRecord = null
        readerPlayStartedAt = null
        readerReplayCount = 0
      }
      render()
    } finally {
      readerFinalizing = false
    }
  }

  async function onAction(event) {
    const target = event.target.closest('[data-action]')
    if (!target) return
    const action = target.dataset.action
    if (TOP_LEVEL_PAGES.includes(action) || action === 'learning' || action === 'experiment' || action === 'notes' || action.startsWith('teaching-') || action === 'experiment-mode' || action === 'experiment-restart') resetInput()
    if (action === 'home') state = { ...state, page: 'home' }
    else if (action === 'learning') state = { ...state, page: 'learning', learningTab: 'teaching' }
    else if (action === 'experiment') state = { ...state, page: 'experiment', experiment: { ...state.experiment, researchMode: state.experiment.researchMode === 'formal' ? 'formal' : 'casual' } }
    else if (action === 'research-entry') { enterFormalExperiment() }
    else if (action === 'research-cancel') { experimentEntryError = ''; formalSession = null; experiment = createExperimentModel({ trialCount: 10 }); state = { ...state, experiment: { ...createAppState().experiment } } }
    else if (action === 'research-submit') { acceptFormalConsent() }
    else if (action === 'research-profile-submit') { void submitFormalProfile().then(() => render()) }
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
    else if (action === 'experiment-tab') { experimentToken++; reader.stop(); readerPlayToken += 1; cancelSpeech(); state = { ...state, experimentTab: target.dataset.tab } }
    else if (action === 'teaching-show-reference') state = { ...state, teaching: { ...state.teaching, examReferenceVisible: true } }
    else if (action === 'teaching-home') state = { ...state, teaching: { ...state.teaching, category: null, section: null, item: null, tone: null, examReferenceVisible: false } }
    else if (action === 'teaching-category') state = { ...state, teaching: { ...state.teaching, category: target.dataset.category, section: null, item: null, tone: null, examReferenceVisible: false } }
    else if (action === 'teaching-continue') {
      const section = target.dataset.section
      const p = sectionProgress(state.teaching.category, section)
      state = { ...state, teaching: { ...state.teaching, section, item: p.current || getTeachingSections(state.teaching.category).find(value => value.id === section).items[0], phase: 'learn', tone: null, examReferenceVisible: false } }
    } else if (action === 'teaching-tone') {
      const tone = target.dataset.tone || null
      state = { ...state, teaching: { ...state.teaching, tone, examReferenceVisible: false }, input: { confirmedCells: [], currentDots: [], cursorIndex: 0 } }
    } else if (action === 'teaching-item') state = { ...state, teaching: { ...state.teaching, section: target.dataset.section, item: decodeURIComponent(target.dataset.item), phase: 'learn', tone: null, examReferenceVisible: false }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-back-section') state = { ...state, teaching: { ...state.teaching, section: null, item: null, examReferenceVisible: false }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-phase') state = { ...state, teaching: { ...state.teaching, phase: target.dataset.phase, examReferenceVisible: target.dataset.phase === 'exam' ? false : state.teaching.examReferenceVisible }, input: { confirmedCells: [], currentDots: [] } }
    else if (action === 'teaching-prev' || action === 'teaching-next') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const index = section.items.indexOf(state.teaching.item) + (action === 'teaching-prev' ? -1 : 1)
      if (section.items[index]) state = { ...state, teaching: { ...state.teaching, item: section.items[index], tone: null, examReferenceVisible: false }, input: { confirmedCells: [], currentDots: [] } }
    } else if (action === 'play-item') { const item = getTeachingItem(state.teaching.category, state.teaching.section, state.teaching.item, getLang(), state.teaching.tone); if (item) { cancelSpeech(); const playback = buildLearningPlayback(item); void playCells(playback.cells, '.lesson-braille') } }
    else if (action === 'mark-learned') {
      const section = getTeachingSections(state.teaching.category).find(value => value.id === state.teaching.section)
      const old = sectionProgress(state.teaching.category, state.teaching.section)
      const next = markTeachingLearned(old, state.teaching.item, section.items)
      saveSectionProgress(state.teaching.category, state.teaching.section, next)
      void progress.markLearned(state.teaching.category, state.teaching.section, state.teaching.item)
      state = { ...state, teaching: { ...state.teaching, item: next.current || state.teaching.item, examReferenceVisible: false } }
    } else if (action === 'experiment-mode') { experimentToken++; cancelSpeech(); experiment.selectMode(target.dataset.mode); state = { ...state, input: { confirmedCells: [], currentDots: [] } } }
    else if (action === 'experiment-start') {
      const formal = state.experiment.researchMode === 'formal'
      const mode = formal ? formalRecognitionModes[formalRecognitionIndex] : undefined
      const phase = formal ? 'formal' : 'casual'
      const seed = formal ? `${formalSessionSeed}:${mode}` : createSessionId('seed')
      experiment.start(mode, { seed, phase })
      state = { ...state, input: { confirmedCells: [], currentDots: [] } }
      void playShowcase()
    }
    else if (action === 'training-play-rules') {
      if (trainingPlaybackBusy) return
      trainingPlaybackBusy = true
      trainingFeedback = ''
      try {
        await speakAndWait(buildTrainingRuleText(getLang()))
        const current = experiment.snapshot()
        if (current.stage === 'training' && current.trainingStep === 'rules') experiment.advanceTrainingStep()
      } finally {
        trainingPlaybackBusy = false
        render()
      }
      return
    }
    else if (action === 'training-play-single' || action === 'training-play-multi') {
      if (trainingPlaybackBusy) return
      trainingPlaybackBusy = true
      trainingFeedback = ''
      try {
        const examples = action === 'training-play-single' ? TRAINING_SINGLE_POINTS.map(dots => [dots]) : TRAINING_MULTI_EXAMPLES
        const completed = await playTrainingExamples(examples, 0.55, '#training-showcase-braille')
        const step = action === 'training-play-single' ? 'single-points' : 'multi-examples'
        const current = experiment.snapshot()
        if (completed && current.stage === 'training' && current.trainingStep === step) experiment.advanceTrainingStep()
      } finally {
        trainingPlaybackBusy = false
        render()
      }
      return
    }
    else if (action === 'training-listen-question') {
      if (trainingPlaybackBusy) return
      const current = experiment.snapshot()
      const trials = current.trainingStep === 'practice' ? current.trainingPracticeTrials : current.trainingCalibrationTrials
      const trial = trials[current.trainingQuestionIndex]
      if (!trial) return
      trainingPlaybackBusy = true
      trainingFeedback = ''
      try {
        const completed = await playTrainingExamples([trial.cells], 0.45)
        if (completed && experiment.snapshot().stage === 'training') experiment.startTrainingQuestion()
      } finally {
        trainingPlaybackBusy = false
        render()
      }
      return
    }
    else if (action === 'training-restart') {
      experimentToken++
      trainingFeedback = ''
      experiment.startTraining()
      state = { ...state, input: { confirmedCells: [], currentDots: [], cursorIndex: 0 } }
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
    else if (action === 'experiment-next-formal-mode') {
      await formalPersistenceQueue.idle()
      if (formalPersistenceFailed) {
        experimentEntryError = '正式辨识记录尚未可靠保存，暂不能进入下一类。'
      } else if (state.experiment.researchMode === 'formal' && experiment.snapshot().stage === 'done') {
        formalRecognitionIndex += 1
        experiment = createFormalRecognitionModel(formalRecognitionModes[formalRecognitionIndex])
        state = { ...state, input: { confirmedCells: [], currentDots: [] } }
      }
    }
    else if (action === 'experiment-finish-recognition') {
      await formalPersistenceQueue.idle()
      if (formalPersistenceFailed) {
        experimentEntryError = '正式辨识记录尚未可靠保存，暂不能进入听书。'
      } else if (state.experiment.researchMode === 'formal' && formalRecognitionIndex === formalRecognitionModes.length - 1 && state.experiment.formalRecognitionModesCompleted.length === formalRecognitionModes.length) {
        state = completeRecognition(state, formalRecognitionModes)
        state = { ...state, experimentTab: 'reader', input: { confirmedCells: [], currentDots: [] } }
      }
    }
    else if (action === 'reader-play') {
      if (state.experiment.researchMode === 'formal' && state.experiment.formalPhase !== 'reader') return
      readerCompleted = false
      readerUnderstood = null
      readerSummary = ''
      readerTrialRecord = null
      readerReplayCount = readerPlayStartedAt ? readerReplayCount + 1 : 0
      readerPlayStartedAt = Date.now()
      activeReaderGeneration = null
      reader.stop()
      readerPlayToken += 1
      const playToken = readerPlayToken
      if (state.experiment.researchMode === 'formal') reader.setSpeed(1)
      const experienceChapter = EXPERIENCE_CHAPTERS.find(chapter => chapter.chapterId === selectedExperienceChapterId)
      const playText = state.page === 'reader' ? (experienceChapter?.brailleCells || []) : state.experiment.researchMode === 'formal' ? selectedReaderPassage.brailleCells : (document.querySelector('#reader-text')?.value || SAMPLE_BRAILLE)
      currentReaderText = Array.isArray(playText) ? playText.map(dots => dotsToUnicode(dots)).join('') : playText
      activeReaderGeneration = reader.snapshot().generation + 1
      const playPromise = reader.play(playText)
      activeReaderGeneration = reader.snapshot().generation
      void playPromise.then(() => { if (playToken !== readerPlayToken) readerCompleted = false })
    }
    else if (action === 'reader-stop') { activeReaderGeneration = null; reader.stop(); readerPlayToken += 1; readerCompleted = false; readerTrialRecord = null; clearPlaybackHighlight() }
    else if (action === 'reader-pause') reader.pause()
    else if (action === 'reader-resume') reader.resume()
    else if (action === 'reader-understood') {
      readerUnderstood = true
      if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, selfReportedUnderstood: true }
      render()
    }
    else if (action === 'reader-not-understood') {
      readerUnderstood = false
      if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, selfReportedUnderstood: false }
      if (state.experiment.researchMode === 'formal') void finalizeFormalReaderTrial(false)
      else render()
    }
    else if (action === 'reader-summary-skip') {
      if (state.experiment.researchMode === 'formal') void finalizeFormalReaderTrial(true, '')
      else render()
    }
    else if (action === 'reader-summary-submit') {
      readerSummary = document.querySelector('#reader-summary')?.value || ''
      if (readerTrialRecord) readerTrialRecord = { ...readerTrialRecord, summaryText: readerSummary, summarySubmitted: readerSummary.trim().length > 0 }
      if (state.experiment.researchMode === 'formal') void finalizeFormalReaderTrial(true, readerSummary)
      else render()
    }
    else if (action === 'experiment-upload') { void uploadFormalData() }
    else if (action === 'experiment-export-json') { void exportFormalData('json') }
    else if (action === 'experiment-export-csv') { void exportFormalData('csv') }
    else if (action === 'notes-save') void notes.save()
    else if (action === 'notes-play-text') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('tts') }
    else if (action === 'notes-play-audio') { noteText = document.querySelector('#note-textarea')?.value || ''; void notes.readAloud('braille', Number(document.querySelector('#notes-speed')?.value || 1)) }
    else if (action === 'notes-export') void notes.exportNote('json')
    else if (action === 'notes-import') document.querySelector('#note-import-file')?.click()
    else if (action === 'notes-new') { notes.newNote(); loadEditorText('notes', '') }
    else if (TOP_LEVEL_PAGES.includes(action)) { experimentToken++; reader.stop(); readerPlayToken += 1; cancelSpeech(); clearPlaybackHighlight(); state = { ...state, page: action, input: { confirmedCells: [], currentDots: [] } } }
    render()
  }

  async function playTrainingExamples(examples, duration = 0.55, targetSelector = null) {
    const token = ++experimentToken
    let playbackIndex = 0
    try {
      for (const cells of examples) {
        if (token !== experimentToken) return false
        for (const cell of buildCellSequence(cells)) {
          if (token !== experimentToken) return false
          setPlaybackHighlight(targetSelector, playbackIndex)
          await playAudioBraille(cell, { duration })
          if (token !== experimentToken) return false
          await new Promise(resolve => setTimeout(resolve, 180))
          playbackIndex += 1
        }
      }
      return true
    } finally {
      if (token === experimentToken) clearPlaybackHighlight(targetSelector)
    }
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
