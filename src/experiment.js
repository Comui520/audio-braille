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

// 构建四类辨识题（v7：统一用 cells）
export function buildTrials(mode, n = 10, lang = 'zh') {
  if (mode === 'letters') return pickLetters(n).map(letter => ({ kind: 'letter', label: letter, cells: toCells(latinToDots(letter)) }))
  if (mode === 'syllables') return pickSyllables(n).map(s => ({
    kind: 'syllable', label: `${s.initial}${s.final}${TONE_NAMES_EXT[s.tone]}`, initial: s.initial, final: s.final, tone: s.tone,
    cells: toCells(syllableToDots(s.initial, s.final, s.tone))
  }))
  if (mode === 'symbols') {
    const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
    return pickSymbols(n, lang).map(ch => ({ kind: 'symbol', label: ch, cells: toCells(table[ch]) }))
  }
  // digits
  const digits = Object.keys(DIGIT_LETTER)
  return digits.sort(() => Math.random() - 0.5).slice(0, n).map(d => ({ kind: 'digit', label: d, cells: toCells(digitDots(d)) }))
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

export function createExperimentModel({ trialCount = 10, lang = 'zh' } = {}) {
  const modes = ['letters', 'syllables', 'symbols', 'digits']
  let mode = 'letters'
  let stage = 'idle'
  let trials = []
  let index = 0
  let results = []

  function snapshot() {
    return {
      mode,
      stage,
      trials: trials.map(trial => ({ ...trial, cells: trial.cells.map(cell => [...cell]) })),
      index,
      results: results.map(result => ({ ...result }))
    }
  }

  function selectMode(nextMode) {
    if (!modes.includes(nextMode)) return snapshot()
    mode = nextMode
    stage = 'idle'
    trials = []
    index = 0
    results = []
    return snapshot()
  }

  function start(nextMode = mode) {
    if (modes.includes(nextMode)) mode = nextMode
    trials = buildTrials(mode, trialCount, lang)
    index = 0
    results = []
    stage = 'showcase'
    return snapshot()
  }

  function confirmShowcase() {
    if (stage !== 'showcase') return snapshot()
    stage = trials.length > 0 ? 'listen' : 'done'
    return snapshot()
  }

  function listen() {
    if (stage !== 'listen') return snapshot()
    stage = 'answer'
    return snapshot()
  }

  function submit(given) {
    if (stage === 'listen') stage = 'answer'
    if (stage !== 'answer' || !trials[index]) return { correct: false, state: snapshot() }
    const trial = trials[index]
    const correct = gradeCells(trial.cells, given)
    results.push({ index, label: trial.label, correct })
    index += 1
    stage = index >= trials.length ? 'done' : 'listen'
    return { correct, state: snapshot() }
  }

  function restart() {
    stage = 'idle'
    trials = []
    index = 0
    results = []
    return snapshot()
  }

  return { snapshot, selectMode, start, confirmShowcase, listen, submit, restart }
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