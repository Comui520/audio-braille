// src/teaching.js —— v5：四子模块（拼音/字母/符号/数字）学→练→考
// 学：逐步引导——介绍键位规则 + 演示例子（"要输入 a 就按 7"）
// 练：有提示练习，错误给具体引导（"a 是点1，按 7"）
// 考：无提示考核 + 错题复习（间隔重复）
// 中文拼音特殊：全标调，多阶段输入（声母→韵母→声调），用 * 下一个 / 上一个切换阶段
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots, INITIALS, FINALS, TONES, syllableToDots, dotsToUnicode } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN, CN_SYMBOL_NAMES, EN_SYMBOL_NAMES } from './data/symbols.js'
import { playAudioBraille } from './audio-braille.js'

// —— 间隔重复错题本（纯逻辑，可测）——
export function createReviewer() {
  const map = new Map()
  function entry(key) {
    if (!map.has(key)) map.set(key, { errors: 0, streak: 0 })
    return map.get(key)
  }
  return {
    record(key, correct) {
      const e = entry(key)
      if (correct) { e.streak += 1; if (e.streak >= 3 && e.errors >= 2) map.delete(key) }
      else { e.errors += 1; e.streak = 0 }
    },
    isInReview(key) {
      const e = map.get(key)
      return !!e && e.errors >= 2 && e.streak < 3
    },
    reviewQueue() { return [...map.keys()].filter(k => this.isInReview(k)) },
    toJSON() { return Object.fromEntries(map) },
    fromJSON(data) { for (const [k, v] of Object.entries(data)) map.set(k, v) }
  }
}

export function pickExamQuestion({ index, reviewQueue }) {
  if (index % 5 === 4 && reviewQueue.length > 0) return reviewQueue[index % reviewQueue.length]
  return null
}

export function gradeAnswer(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

export function isLearnPhase(phase) { return phase === 'learn' }

// —— 四子模块（v5）——
export const LESSON_TYPES = ['pinyin', 'latin', 'symbols', 'digits']
export const TONE_NAMES = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }

// 数字 → 字母方（盲文数字：数字符号 + a-j）
const DIGIT_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }

// 拼音带调音节样例（全标调教学）
const PINYIN_SYLLABLES = [
  { initial: 'm', final: 'a', tone: '1' }, { initial: 'b', final: 'a', tone: '1' },
  { initial: 'h', final: 'ao', tone: '3' }, { initial: 'n', final: 'i', tone: '3' },
  { initial: 'l', final: 'e', tone: '4' }, { initial: 'd', final: 'a', tone: '1' },
  { initial: 'g', final: 'e', tone: '1' }, { initial: 'sh', final: 'i', tone: '4' },
  { initial: 'z', final: 'ao', tone: '3' }, { initial: 'x', final: 'ue', tone: '2' }
]

// 出题（纯逻辑，可测）
// kind: pinyin | latin | symbols | digits
// index: 题号（学/练顺序，考随机）
export function pickLessonItem(kind, index, lang = 'zh') {
  if (kind === 'latin') {
    const letters = Object.keys(LATIN_LETTERS)
    const letter = letters[index % letters.length]
    return { type: 'letter', label: letter, ch: letter, dots: latinToDots(letter) }
  }
  if (kind === 'symbols') {
    const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
    const names = lang === 'en' ? EN_SYMBOL_NAMES : CN_SYMBOL_NAMES
    const keys = Object.keys(table)
    const ch = keys[index % keys.length]
    return { type: 'symbol', label: names[ch] || ch, ch, dots: table[ch] }
  }
  if (kind === 'digits') {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    const d = digits[index % digits.length]
    const letter = DIGIT_LETTER[d]
    return { type: 'digit', label: d, ch: d, dots: [[3, 4, 5, 6], latinToDots(letter)] }
  }
  // pinyin：先声母（18）→ 韵母（34）→ 带调音节
  const initials = Object.keys(INITIALS).filter(k => !['j', 'q', 'x'].includes(k))
  const finals = Object.keys(FINALS)
  const i = index % (initials.length + finals.length + PINYIN_SYLLABLES.length)
  if (i < initials.length) {
    const ini = initials[i]
    return { type: 'initial', label: ini, ch: ini, dots: INITIALS[ini] }
  }
  if (i < initials.length + finals.length) {
    const fin = finals[i - initials.length]
    return { type: 'final', label: fin, ch: fin, dots: FINALS[fin] }
  }
  const s = PINYIN_SYLLABLES[(i - initials.length - finals.length) % PINYIN_SYLLABLES.length]
  const toneName = TONE_NAMES[s.tone] || ''
  return {
    type: 'syllable', initial: s.initial, final: s.final, tone: s.tone,
    label: `${s.initial}${s.final}${toneName}`, ch: `${s.initial}${s.final}`,
    dots: syllableToDots(s.initial, s.final, s.tone)
  }
}

// 键位 → 教学提示（官方键位：7=点1, 4=点2, 1=点3, 8=点4, 5=点5, 2=点6）
export function keyHintForDots(dots) {
  const KEY_FOR_DOT = { 1: '7', 2: '4', 3: '1', 4: '8', 5: '5', 6: '2' }
  return dots.flat().map(d => KEY_FOR_DOT[d]).filter(Boolean).join('、')
}

// —— 教学 UI（四子模块 × 学练考）——
export function initTeaching({ state, render, storage, kind = 'latin', lang = 'zh' }) {
  const reviewer = createReviewer()
  let phase = 'learn'       // learn | practice | exam
  let currentItem = null
  let index = 0             // 当前题号（学/练顺序推进）
  let examCorrect = 0
  let examTotal = 0
  let lessonEl = null
  const withTone = () => kind === 'pinyin'   // 拼音全标调

  function setLesson(msg) { if (lessonEl) lessonEl.textContent = msg }

  function next() {
    if (phase === 'exam' && examTotal >= 10) {
      const acc = Math.round((examCorrect / examTotal) * 100)
      const msg = t('examOver', { accuracy: String(acc) })
      speak(msg); setLesson(msg)
      index = 0; examCorrect = 0; examTotal = 0
      return
    }
    currentItem = pickLessonItem(kind, index, lang)
    const L = currentItem.label
    if (phase === 'learn') {
      // 学：逐步引导——键位规则 + 例子
      const hint = keyHintForDots(currentItem.dots)
      speak(t('learnItem', { label: L, hint }))
      setLesson(t('learnItem', { label: L, hint }))
    } else if (phase === 'practice') {
      speak(t('practiceItem', { label: L }))
      setLesson(t('practiceItem', { label: L }))
    } else {
      speak(t('q', { label: L }) + '，' + t('press0Submit'))
      setLesson(t('q', { label: L }) + '（' + t('press0Submit') + '）')
    }
    state.clearDots()
    index++
  }

  function checkAnswer(dots) {
    if (!currentItem) return
    // 多方式标点/数字：展平后无序比较
    const expected = currentItem.dots.flat()
    const correct = gradeAnswer(expected, dots)
    const key = `${kind}:${currentItem.label}`
    if (correct) {
      speak(t('correct'))
      reviewer.record(key, true)
      if (phase === 'exam') { examCorrect++; examTotal++ }
    } else {
      const hint = keyHintForDots(currentItem.dots)
      speak(t('wrongAnswer', { expected: `${currentItem.label}（键位：${hint}）` }))
      reviewer.record(key, false)
      if (phase === 'exam') { examTotal++ }
    }
    state.clearDots()
    setTimeout(next, 400)
  }

  return {
    reviewer,
    phase: () => phase,
    currentItem: () => currentItem,
    kind: () => kind,
    async init(m) {
      phase = m
      index = 0; examCorrect = 0; examTotal = 0
      currentItem = null
      next()
    },
    handleConfirm(dots) { if (currentItem) checkAnswer(dots) },
    // 拼音阶段切换（* 下一个 / 上一个），由 input.js 调用
    setPhase(stage) { state.inputStage = stage; render() },
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `<h1>${t('lessonTitle')}${kind === 'pinyin' ? '（拼音）' : kind === 'latin' ? '（字母）' : kind === 'symbols' ? '（符号）' : '（数字）'}</h1>
        <div class="phase-buttons">
          <button data-phase="learn" class="phase-btn active">${t('learnBtn')}</button>
          <button data-phase="practice" class="phase-btn">${t('practiceBtn')}</button>
          <button data-phase="exam" class="phase-btn">${t('examBtn')}</button>
        </div>
        <div id="lesson" aria-live="polite"></div>`
      return sec
    },
    bind(container) {
      lessonEl = container.querySelector('#lesson')
      container.querySelectorAll('[data-phase]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          void this.init(btn.dataset.phase)
        })
      })
    }
  }
}
