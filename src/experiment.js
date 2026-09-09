// src/experiment.js —— v5：AudioBraille 展示环节 + 四类辨识
// 用户设想：播放 AudioBraille 音频（左列=左耳/右列=右耳/上行600Hz/中行400Hz/下行250Hz/左正弦右方波），
// 测试人能否仅凭耳朵分辨出是哪个字母/音节/符号/数字。可行性测试。
// 流程：
//   点击开始 → 展示环节（先听每个点的左右声道对应关系）→ "按0进入测试"
//   按0 → 逐题：按0听音频 → 输点位 → 按0提交 → 判定 → 下一题 → 汇总
import { playAudioBraille, buildCellSequence } from './audio-braille.js'
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots } from './braille-engine.js'
import { INITIALS, FINALS, TONES, syllableToDots } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'
import { toCells, gradeCells } from './cells.js'
import { buildRecognitionBank, sampleRecognitionTrials } from './experiment-bank.js'
import { validateFormalRecord } from './experiment-protocol.js'

// ===== 展示环节（先听左右声道对应关系）=====
export const SHOWCASE_DOTS = [[1], [2], [3], [4], [5], [6]]
export function pointDesc(dot) {
  const side = dot <= 3 ? '左' : '右'
  const r = dot % 3
  const row = r === 1 ? '高音' : r === 2 ? '中音' : '低音'
  return `点${dot}：${side}耳${row}`
}
export function buildShowcase() {
  return SHOWCASE_DOTS.map((dots, i) => ({ dot: i + 1, dots, desc: pointDesc(i + 1) }))
}

export function buildShowcaseInstruction(lang = 'zh') {
  if (lang === 'en') return 'Showcase starts. Dots 1, 2 and 3 use the left ear with sine waves; dots 4, 5 and 6 use the right ear with square waves. In each column, top, middle and bottom are high, mid and low pitch. The six sounds will now play in order.'
  return '展示开始。点一、二、三使用左耳正弦波；点四、五、六使用右耳方波。每列从上到下分别是高音、中音、低音。现在按顺序播放六个声音。'
}

// 正式实验统一训练固定内容：规则 → 六个单点 → 多点示例 → 不计分练习 → 校准。
export const TRAINING_STEPS = ['rules', 'single-points', 'multi-examples', 'practice', 'calibration']
export const TRAINING_SINGLE_POINTS = [[1], [2], [3], [4], [5], [6]]
export const TRAINING_MULTI_EXAMPLES = [[[1, 2]], [[4, 5]], [[1, 3, 5]], [[2, 4, 6]]]
export const TRAINING_PRACTICE_TRIALS = [
  { id: 'practice-1', label: '点一', cells: [[1]] },
  { id: 'practice-2', label: '点四', cells: [[4]] },
  { id: 'practice-3', label: '点一和点四', cells: [[1, 4]] }
]
export const TRAINING_CALIBRATION_TRIALS = [
  { id: 'calibration-1', label: '校准一', cells: [[2]] },
  { id: 'calibration-2', label: '校准二', cells: [[5, 6]] },
  { id: 'calibration-3', label: '校准三', cells: [[1, 3, 4]] }
]
export const CALIBRATION_PASS_SCORE = 2
export const TRAINING_BANK_VERSION = 'training-v13-2'

export function buildTrainingRuleText(lang = 'zh') {
  if (lang === 'en') return 'This is the AudioBraille training and calibration. Each braille cell is played as a chord. Dots one, two and three are in the left ear with sine waves; dots four, five and six are in the right ear with square waves. The top, middle and bottom positions are high, middle and low pitch. You will first hear the rules, then six single-dot examples, several multi-dot examples, unscored practice, and fixed calibration questions. Training data is not included in the main formal results.'
  return '这是 AudioBraille 统一训练和校准。每个盲文方会作为和弦播放。点一、二、三在左耳使用正弦波，点四、五、六在右耳使用方波；每列从上到下分别是高音、中音和低音。接下来先听完整规则，再听六个单点和多点示例，然后完成不计分练习，最后完成固定校准题。训练数据不会计入正式实验主要结果。'
}

export function buildTrainingPlan() {
  return {
    steps: [...TRAINING_STEPS],
    singlePoints: TRAINING_SINGLE_POINTS.map(cell => [...cell]),
    multiExamples: TRAINING_MULTI_EXAMPLES.map(cell => cell.map(dot => [...dot])),
    practiceTrials: TRAINING_PRACTICE_TRIALS.map(trial => ({ ...trial, cells: trial.cells.map(cell => [...cell]) })),
    calibrationTrials: TRAINING_CALIBRATION_TRIALS.map(trial => ({ ...trial, cells: trial.cells.map(cell => [...cell]) }))
  }
}


// 随机不重复字母
export function pickLetters(n = 10) {
  return Object.keys(LATIN_LETTERS).sort(() => Math.random() - 0.5).slice(0, n)
}
export const pickTrialLetters = pickLetters   // 旧名兼容

// 拼音音节样例题
const PINYIN_POOL = [
  { initial: 'm', final: 'a', tone: '1' }, { initial: 'b', final: 'a', tone: '1' },
  { initial: 'h', final: 'ao', tone: '3' }, { initial: 'n', final: 'i', tone: '3' },
  { initial: 'l', final: 'e', tone: '4' }, { initial: 'd', final: 'a', tone: '1' },
  { initial: 'g', final: 'e', tone: '1' }, { initial: 'sh', final: 'i', tone: '4' },
  { initial: 'z', final: 'ao', tone: '3' }, { initial: 'x', final: 'ue', tone: '2' }
]
const TONE_NAMES_EXT = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }
export function pickSyllables(n = 10) {
  return PINYIN_POOL.sort(() => Math.random() - 0.5).slice(0, n)
}

// 随机符号
export function pickSymbols(n = 10, lang = 'zh') {
  const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
  return Object.keys(table).sort(() => Math.random() - 0.5).slice(0, n)
}

// 数字 → 字母（盲文数字）
const DIGIT_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }
function digitDots(d) { return [[3, 4, 5, 6], latinToDots(DIGIT_LETTER[d])] }

export function buildTrials(mode, n = 10, lang = 'zh', options = {}) {
  const bank = buildRecognitionBank(lang)[mode] || []
  const sourceBank = options.phase === 'formal' || mode !== 'syllables'
    ? bank
    : bank.filter(item => item.cellCount >= 2)
  const seed = options.seed || `${mode}-${Math.random()}`
  return sampleRecognitionTrials(sourceBank, n, seed).map(item => ({
    ...item,
    kind: mode === 'syllables' ? 'syllable' : mode === 'letters' ? 'letter' : mode === 'symbols' ? 'symbol' : 'digit'
  }))
}

// ===== 点位比较（v7：转发到 cells.gradeCells，唯一权威）=====
export function gradeDots(expected, given) {
  return gradeCells(expected, given)
}
// 单方式无序比较（旧语义，仅供旧测试）
export function gradeDotsFlat(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// 生成随机点位（3-6 点，供测试/旧兼容）
export function createAudioTrial() {
  const n = 3 + Math.floor(Math.random() * 4)
  const pool = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5)
  return { dots: pool.slice(0, n).sort((a, b) => a - b) }
}
export function pickTrialDots(n = 10) {
  const seen = new Set()
  const out = []
  while (out.length < n) {
    const tr = createAudioTrial()
    const key = tr.dots.join(',')
    if (!seen.has(key)) { seen.add(key); out.push(tr.dots) }
  }
  return out
}

// 实验数据模型
export function createExperiment() {
  const trials = []
  return {
    addTrial(cellDots, guess, timeSec, correct) {
      trials.push({ dots: cellDots, guess, timeSec, correct })
    },
    trials() { return [...trials] },
    summarize() {
      const n = trials.length
      const correct = trials.filter(x => x.correct).length
      const avgTime = n ? trials.reduce((a, x) => a + x.timeSec, 0) / n : 0
      return { count: n, accuracy: n ? correct / n : 0, avgTime }
    }
  }
}
export function summarize(exp) { return exp.summarize() }

// ===== 纯逻辑实验模型（v9）=====
export const EXPERIMENT_TABS = ['recognition', 'reader']
export function getExperimentTabs() { return [...EXPERIMENT_TABS] }

function hashCells(cells = []) {
  const text = cells.map(cell => cell.join(',')).join('|')
  let hash = 2166136261
  for (const char of text) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function createExperimentModel({
  trialCount = 10,
  lang = 'zh',
  dataClass = 'casual',
  studyVersion = null,
  consentAccepted = false,
  participantId = null,
  sessionId = null
} = {}) {
  const modes = ['letters', 'syllables', 'symbols', 'digits']
  let mode = 'letters'
  let stage = 'idle'
  let trials = []
  let index = 0
  let results = []
  let currentPhase = dataClass === 'formal' ? 'formal' : 'casual'
  let currentSeed = null
  let listenedAtMs = null
  let blocked = null
  let trainingStarted = false
  let trainingCompleted = false
  let calibrationPassed = null
  let calibrationAttempts = 0
  let qualityFlags = []
  let trainingStep = 'idle'
  let trainingStepPlayed = false
  let trainingQuestionIndex = 0
  let trainingQuestionStarted = false
  let trainingQuestionStartedAt = null
  let trainingPracticeResults = []
  let trainingCalibrationResults = []
  let roundNumber = 0
  let replayCount = 0

  function copyTrial(trial) {
    return { ...trial, cells: trial.cells.map(cell => [...cell]) }
  }

  function copyResult(result) {
    return {
      ...result,
      record: result.record ? {
        ...result.record,
        responseCells: result.record.responseCells.map(cell => [...cell])
      } : undefined
    }
  }

  function snapshot() {
    return {
      mode,
      stage,
      blocked,
      dataClass,
      studyVersion,
      participantId,
      sessionId,
      phase: currentPhase,
      randomSeed: currentSeed,
      trainingStarted,
      trainingCompleted,
      calibrationPassed,
      calibrationAttempts,
      qualityFlags: [...qualityFlags],
      trainingStep,
      trainingStepPlayed,
      trainingQuestionIndex,
      trainingQuestionStarted,
      trainingQuestionStartedAt,
      trainingPracticeTrials: TRAINING_PRACTICE_TRIALS.map(trial => ({ ...trial, cells: trial.cells.map(cell => [...cell]) })),
      trainingCalibrationTrials: TRAINING_CALIBRATION_TRIALS.map(trial => ({ ...trial, cells: trial.cells.map(cell => [...cell]) })),
      trainingPracticeResults: trainingPracticeResults.map(result => ({ ...result, responseCells: result.responseCells.map(cell => [...cell]) })),
      trainingCalibrationResults: trainingCalibrationResults.map(result => ({ ...result, responseCells: result.responseCells.map(cell => [...cell]) })),
      trainingCalibrationScore: trainingCalibrationResults.filter(result => result.correct).length,
      trials: trials.map(copyTrial),
      index,
      results: results.map(copyResult)
    }
  }

  function resetRound() {
    trials = []
    index = 0
    results = []
    listenedAtMs = null
  }
  function selectMode(nextMode) {
    if (!modes.includes(nextMode)) return snapshot()
    mode = nextMode
    stage = 'idle'
    blocked = null
    resetRound()
    return snapshot()
  }

  function start(nextMode = mode, options = {}) {
    if (dataClass === 'formal' && !validateFormalRecord({
      dataClass, consentAccepted, studyVersion, participantId, sessionId
    }).valid) {
      stage = 'idle'
      resetRound()
      blocked = 'consent-required'
      return snapshot()
    }
    blocked = null
    if (modes.includes(nextMode)) mode = nextMode
    currentPhase = options.phase || (dataClass === 'formal' ? 'formal' : dataClass)
    if (!['casual', 'training', 'formal'].includes(currentPhase)) currentPhase = dataClass
    currentSeed = options.seed || `${currentPhase}:${mode}:${Date.now()}`
    roundNumber += 1
    trials = buildTrials(mode, trialCount, lang, { ...options, seed: currentSeed })
    index = 0
    results = []
    listenedAtMs = null
    replayCount = 0
    stage = 'showcase'
    return snapshot()
  }

  function startTraining() {
    const wasStarted = trainingStarted
    trainingStarted = true
    trainingCompleted = false
    calibrationPassed = null
    currentPhase = 'training'
    if (!wasStarted) {
      calibrationAttempts = 0
      qualityFlags = []
    }
    trainingStep = 'rules'
    trainingStepPlayed = false
    trainingQuestionIndex = 0
    trainingQuestionStarted = false
    trainingQuestionStartedAt = null
    trainingPracticeResults = []
    trainingCalibrationResults = []
    stage = 'training'
    return snapshot()
  }

  function markTrainingStepPlayed() {
    if (stage !== 'training') return snapshot()
    trainingStepPlayed = true
    return snapshot()
  }

  function advanceTrainingStep() {
    if (stage !== 'training' || !trainingStepPlayed) return snapshot()
    const index = TRAINING_STEPS.indexOf(trainingStep)
    if (index < 0 || index >= TRAINING_STEPS.length - 1) return snapshot()
    trainingStep = TRAINING_STEPS[index + 1]
    trainingStepPlayed = false
    trainingQuestionIndex = 0
    trainingQuestionStarted = false
    trainingQuestionStartedAt = null
    return snapshot()
  }

  function startTrainingQuestion() {
    if (stage !== 'training' || !['practice', 'calibration'].includes(trainingStep)) return snapshot()
    const trials = trainingStep === 'practice' ? TRAINING_PRACTICE_TRIALS : TRAINING_CALIBRATION_TRIALS
    if (!trials[trainingQuestionIndex]) return snapshot()
    if (trainingQuestionStarted) return snapshot()
    trainingQuestionStarted = true
    trainingQuestionStartedAt = Date.now()
    return snapshot()
  }

  function submitTrainingAnswer(given) {
    if (stage !== 'training' || !['practice', 'calibration'].includes(trainingStep)) {
      return { correct: false, finished: false, state: snapshot(), reason: 'training-not-active' }
    }
    if (!trainingQuestionStarted) {
      return { correct: false, finished: false, state: snapshot(), reason: 'training-question-not-played' }
    }
    const trials = trainingStep === 'practice' ? TRAINING_PRACTICE_TRIALS : TRAINING_CALIBRATION_TRIALS
    const trial = trials[trainingQuestionIndex]
    if (!trial) return { correct: false, finished: false, state: snapshot(), reason: 'training-question-missing' }
    const responseCells = Array.isArray(given) ? given.map(cell => [...cell]) : []
    const correct = gradeCells(trial.cells, responseCells)
    const submittedAt = Date.now()
    const listenStartedAt = trainingQuestionStartedAt
    const record = {
      trialId: `${sessionId || 'session'}:training:${trainingStep}:${trainingQuestionIndex}:${trial.id}`,
      stimulusId: `training:${trainingStep}:${trial.id}`,
      bankVersion: TRAINING_BANK_VERSION,
      trialIndex: trainingQuestionIndex,
      mode: trainingStep,
      phase: 'training',
      dataClass: 'training',
      studyVersion,
      listenStartedAt,
      submittedAt,
      reactionTimeMs: typeof listenStartedAt === 'number' ? Math.max(0, submittedAt - listenStartedAt) : null,
      replayCount: 0,
      responseCells,
      expectedCellsHash: hashCells(trial.cells),
      correct
    }
    const result = { trialId: trial.id, trialIndex: trainingQuestionIndex, responseCells, correct, record }
    if (trainingStep === 'practice') trainingPracticeResults.push(result)
    else trainingCalibrationResults.push(result)
    trainingQuestionIndex += 1
    trainingQuestionStarted = false
    trainingQuestionStartedAt = null
    if (trainingStep === 'practice' && trainingQuestionIndex >= TRAINING_PRACTICE_TRIALS.length) {
      trainingStep = 'calibration'
      trainingQuestionIndex = 0
    }
    if (trainingStep === 'calibration' && trainingQuestionIndex >= TRAINING_CALIBRATION_TRIALS.length) {
      calibrationAttempts += 1
      calibrationPassed = trainingCalibrationResults.filter(item => item.correct).length >= CALIBRATION_PASS_SCORE
      trainingCompleted = true
      if (!calibrationPassed && !qualityFlags.includes('calibration-failed')) qualityFlags.push('calibration-failed')
      trainingStep = 'complete'
      stage = 'idle'
      return { ...result, finished: true, passed: calibrationPassed, score: trainingCalibrationResults.filter(item => item.correct).length, state: snapshot() }
    }
    return { ...result, finished: false, state: snapshot() }
  }

  function completeCalibration(passed = false) {
    if (stage !== 'training') {
      if (!qualityFlags.includes('calibration-out-of-sequence')) qualityFlags.push('calibration-out-of-sequence')
      return snapshot()
    }
    calibrationAttempts += 1
    calibrationPassed = Boolean(passed)
    trainingCompleted = true
    if (!passed && !qualityFlags.includes('calibration-failed')) qualityFlags.push('calibration-failed')
    stage = 'idle'
    return snapshot()
  }

  function replay() {
    if (stage !== 'answer') return snapshot()
    replayCount += 1
    return snapshot()
  }

  function confirmShowcase() {
    if (stage !== 'showcase') return snapshot()
    stage = trials.length > 0 ? 'listen' : 'done'
    return snapshot()
  }

  function listen(now = null) {
    if (stage !== 'listen') return snapshot()
    listenedAtMs = typeof now === 'number' ? now : Date.now()
    replayCount = 0
    stage = 'answer'
    return snapshot()
  }

  function submit(given, options = {}) {
    if (stage === 'listen') {
      listenedAtMs = typeof options.listenStartedAt === 'number' ? options.listenStartedAt : listenedAtMs
      stage = 'answer'
    }
    if (stage !== 'answer' || !trials[index]) return { correct: false, state: snapshot() }
    const trial = trials[index]
    const responseCells = Array.isArray(given) ? given.map(cell => [...cell]) : []
    const correct = gradeCells(trial.cells, responseCells)
    const submittedAt = typeof options.submittedAt === 'number' ? options.submittedAt : Date.now()
    const replayCountForRecord = Number.isInteger(options.replayCount) && options.replayCount >= 0
      ? options.replayCount
      : replayCount
    const record = {
      trialId: `${sessionId || 'session'}:${currentPhase}:${mode}:${roundNumber}:${index}`,
      stimulusId: trial.stimulusId,
      bankVersion: trial.bankVersion,
      trialIndex: index,
      mode,
      phase: currentPhase,
      studyVersion,
      dataClass: currentPhase === 'training' ? 'training' : dataClass,
      listenStartedAt: listenedAtMs,
      submittedAt,
      reactionTimeMs: typeof listenedAtMs === 'number' ? Math.max(0, submittedAt - listenedAtMs) : null,
      replayCount: replayCountForRecord,
      responseCells,
      expectedCellsHash: hashCells(trial.cells),
      correct
    }
    results.push({ index, label: trial.label, correct, record })
    index += 1
    listenedAtMs = null
    stage = index >= trials.length ? 'done' : 'listen'
    return { correct, record, state: snapshot() }
  }

  function restart() {
    stage = 'idle'
    blocked = null
    resetRound()
    return snapshot()
  }

  return {
    snapshot, selectMode, start, startTraining, markTrainingStepPlayed, advanceTrainingStep, startTrainingQuestion, submitTrainingAnswer, completeCalibration, replay,
    confirmShowcase, listen, submit, restart
  }
}
// ===== 旧 UI 适配层（任务 7 会移除页面接线）=====
export function initExperiment({ state, render }) {
  const exp = createExperiment()
  let stage = 'idle'       // idle | showcase | confirm | listen | answer | done
  let mode = 'letters'     // letters | syllables | symbols | digits
  let current = null       // { kind, label, cells[], startTime }
  let trials = []
  let idx = 0

  function setStatus(msg) { const el = document.querySelector('#exp-status'); if (el) el.textContent = msg }

  // v7：多方题目逐方播放（旧 bug：多层点位传给 playAudioBraille 导致频率 undefined → 静音）
  function playCurrentAudio() {
    if (!current) return
    const seq = buildCellSequence(current.cells)
    seq.forEach((cell, i) => {
      setTimeout(() => playAudioBraille(cell, { duration: 0.5 }), i * 700)
    })
  }

  function nextListen() {
    if (idx >= trials.length) {
      stage = 'done'
      const s = exp.summarize()
      const acc = Math.round(s.accuracy * 100)
      const msg = t('expDone', { accuracy: String(acc), time: s.avgTime.toFixed(1) })
      setStatus(msg); speak(msg)
      return
    }
    const item = trials[idx]
    current = { ...item, startTime: null }
    stage = 'listen'
    setStatus(t('expListen', { label: String(idx + 1), total: String(trials.length) }))
  }

  return {
    exp, mode: () => mode,
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `<h1>${t('expTitle')}</h1>
        <div class="exp-modes">
          <button data-exp-mode="letters" class="exp-mode-btn active">${t('expModeLetters')}</button>
          <button data-exp-mode="syllables" class="exp-mode-btn">${t('expModeSyllables')}</button>
          <button data-exp-mode="symbols" class="exp-mode-btn">${t('expModeSymbols')}</button>
          <button data-exp-mode="digits" class="exp-mode-btn">${t('expModeDigits')}</button>
        </div>
        <button data-exp="start" class="btn-primary">▶ ${t('expStart')}</button>
        <div id="exp-status" aria-live="polite"></div>`
      return sec
    },
    bind(container) {
      container.querySelector('[data-exp="start"]')?.addEventListener('click', () => this.start())
      container.querySelectorAll('[data-exp-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          mode = btn.dataset.expMode
          container.querySelectorAll('.exp-mode-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          render()
        })
      })
    },
    start() {
      // 展示环节：逐个播放 1-6 点声音 + 播报
      stage = 'showcase'
      trials = []
      idx = 0
      const showcase = buildShowcase()
      setStatus(t('expShowcase'))
      speak(t('expShowcase'))
      showcase.forEach((s, i) => {
        setTimeout(() => {
          playAudioBraille(s.dots, { duration: 0.5 })
          speak(s.desc)
        }, i * 1100)
      })
      // 展示完后进入 confirm
      setTimeout(() => {
        stage = 'confirm'
        setStatus(t('expConfirm'))
      }, showcase.length * 1100 + 500)
    },
    // 按 0 统一入口（app.js 注入）
    handleKey0(dots) {
      if (stage === 'confirm') {
        stage = 'listen'
        idx = 0
        trials = buildTrials(mode, 10)
        nextListen()
        return
      }
      if (stage === 'listen' && dots.length === 0) {
        playCurrentAudio()
        current.startTime = performance.now()
        stage = 'answer'
        setStatus(t('expAnswer'))
        return
      }
      if (stage === 'answer' && dots.length > 0) {
        submitGuess(dots)
        return
      }
      if (stage === 'answer' && dots.length === 0) {
        playCurrentAudio()   // 重听
        return
      }
    },
    replay() { playCurrentAudio() }
  }

  function submitGuess(guessDots) {
    // v7：统一用 gradeCells（方数相等 + 方内无序 + 方序固定）
    const correct = gradeCells(current.cells, guessDots)
    const elapsed = current.startTime ? (performance.now() - current.startTime) / 1000 : 0
    exp.addTrial(current.cells, guessDots, elapsed, correct)
    if (correct) {
      speak(t('correct')); setStatus(t('correct'))
    } else {
      speak(t('expWrong', { letter: current.label }))
      setStatus(t('expWrong', { letter: current.label }))
    }
    state.clearDots()
    idx++
    setTimeout(nextListen, 1600)
  }
}
