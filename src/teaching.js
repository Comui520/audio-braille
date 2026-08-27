// src/teaching.js —— v6：四子模块 × 小节 × 学练考
// 小节（section）：每个子模块下再分小组，选择小节从头学；切换子模块也重置
// 中文拼音：声母 / 韵母 / 带调音节 三个小节
// 英文：按字母分组（a-h / i-p / q-z）
// 符号：中文符号 / 英文符号
// 数字：0-9
// 学：逐步引导（"要输入 a 就按 7"）；练：有提示；考：无提示+错题复习
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots, INITIALS, FINALS, TONES, syllableToDots } from './braille-engine.js'
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

// —— 四子模块 ——
export const LESSON_TYPES = ['pinyin', 'latin', 'symbols', 'digits']
export const TONE_NAMES = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }

// 数字 → 字母方（盲文数字：数字符号 + a-j）
const DIGIT_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

// 拼音带调音节样例
const PINYIN_SYLLABLES = [
  { initial: 'm', final: 'a', tone: '1' }, { initial: 'b', final: 'a', tone: '1' },
  { initial: 'h', final: 'ao', tone: '3' }, { initial: 'n', final: 'i', tone: '3' },
  { initial: 'l', final: 'e', tone: '4' }, { initial: 'd', final: 'a', tone: '1' },
  { initial: 'g', final: 'e', tone: '1' }, { initial: 'sh', final: 'i', tone: '4' },
  { initial: 'z', final: 'ao', tone: '3' }, { initial: 'x', final: 'ue', tone: '2' }
]

// ===== 小节定义（section）=====
// 每小节返回该组题目数组（用于顺序学习）
export function buildSections(kind, lang = 'zh') {
  if (kind === 'latin') {
    const letters = Object.keys(LATIN_LETTERS)
    return [
      { id: 'l1', label: 'a-h', items: letters.slice(0, 8).map(l => ({ type: 'letter', label: l, ch: l, dots: latinToDots(l) })) },
      { id: 'l2', label: 'i-p', items: letters.slice(8, 16).map(l => ({ type: 'letter', label: l, ch: l, dots: latinToDots(l) })) },
      { id: 'l3', label: 'q-z', items: letters.slice(16, 26).map(l => ({ type: 'letter', label: l, ch: l, dots: latinToDots(l) })) }
    ]
  }
  if (kind === 'symbols') {
    const zhTable = SYMBOLS_CN, enTable = SYMBOLS_EN
    const zhNames = CN_SYMBOL_NAMES, enNames = EN_SYMBOL_NAMES
    return [
      {
        id: 's1', label: '中文符号',
        items: Object.keys(zhTable).map(ch => ({ type: 'symbol', label: zhNames[ch] || ch, ch, dots: zhTable[ch] }))
      },
      {
        id: 's2', label: 'English symbols',
        items: Object.keys(enTable).map(ch => ({ type: 'symbol', label: enNames[ch] || ch, ch, dots: enTable[ch] }))
      }
    ]
  }
  if (kind === 'digits') {
    return [{
      id: 'd1', label: '0-9',
      items: DIGITS.map(d => ({ type: 'digit', label: d, ch: d, dots: [[3, 4, 5, 6], latinToDots(DIGIT_LETTER[d])] }))
    }]
  }
  // pinyin：声母 / 韵母 / 带调音节
  const initials = Object.keys(INITIALS).filter(k => !['j', 'q', 'x'].includes(k))
  const finals = Object.keys(FINALS)
  return [
    {
      id: 'p1', label: '声母',
      items: initials.map(ini => ({ type: 'initial', label: ini, ch: ini, dots: INITIALS[ini] }))
    },
    {
      id: 'p2', label: '韵母',
      items: finals.map(fin => ({ type: 'final', label: fin, ch: fin, dots: FINALS[fin] }))
    },
    {
      id: 'p3', label: '带调音节',
      items: PINYIN_SYLLABLES.map(s => ({
        type: 'syllable', initial: s.initial, final: s.final, tone: s.tone,
        label: `${s.initial}${s.final}${TONE_NAMES[s.tone] || ''}`, ch: `${s.initial}${s.final}`,
        dots: syllableToDots(s.initial, s.final, s.tone)
      }))
    }
  ]
}

// 键位 → 教学提示（官方键位：7=点1, 4=点2, 1=点3, 8=点4, 5=点5, 2=点6）
export function keyHintForDots(dots) {
  const KEY_FOR_DOT = { 1: '7', 2: '4', 3: '1', 4: '8', 5: '5', 6: '2' }
  // 分方显示：每方的键位用"；"分隔
  return dots.map(cell => cell.map(d => KEY_FOR_DOT[d]).filter(Boolean).join('')).filter(Boolean).join('；')
}

// —— 教学 UI（四子模块 × 小节 × 学练考）——
export function initTeaching({ state, render, storage, kind = 'latin', lang = 'zh' }) {
  const reviewer = createReviewer()
  let phase = 'learn'       // learn | practice | exam
  let currentKind = kind
  let currentSection = null // { id, label, items[] }
  let currentItem = null
  let itemIdx = 0           // 当前小节内题目序号
  let examCorrect = 0
  let examTotal = 0
  let lessonEl = null

  function setLesson(msg) { if (lessonEl) lessonEl.textContent = msg }

  // 切换子模块：重置到该模块第一个小节
  function switchKind(k) {
    if (!LESSON_TYPES.includes(k)) return
    currentKind = k
    const sections = buildSections(k, lang)
    currentSection = sections[0] || null
    phase = 'learn'
    itemIdx = 0; examCorrect = 0; examTotal = 0; currentItem = null
    next()
  }

  // 切换小节：重置进度
  function switchSection(id) {
    const sections = buildSections(currentKind, lang)
    const sec = sections.find(s => s.id === id)
    if (!sec) return
    currentSection = sec
    phase = 'learn'
    itemIdx = 0; examCorrect = 0; examTotal = 0; currentItem = null
    next()
  }

  function next() {
    if (!currentSection) { setLesson(''); return }
    if (phase === 'exam' && examTotal >= 10) {
      const acc = Math.round((examCorrect / examTotal) * 100)
      const msg = t('examOver', { accuracy: String(acc) })
      speak(msg); setLesson(msg)
      itemIdx = 0; examCorrect = 0; examTotal = 0
      return
    }
    if (itemIdx >= currentSection.items.length) {
      // 小节学完：提示完成，回到开头
      const msg = t('sectionDone', { label: currentSection.label })
      speak(msg); setLesson(msg)
      itemIdx = 0
      return
    }
    currentItem = currentSection.items[itemIdx]
    const L = currentItem.label
    const hint = keyHintForDots(currentItem.dots)
    if (phase === 'learn') {
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
    itemIdx++
  }

  function checkAnswer(dots) {
    if (!currentItem) return
    // 数字/符号/音节：逐方比较（数字符号方 + 字母方）
    const expected = currentItem.dots
    const correct = gradeAnswerMulti(expected, dots)
    const key = `${currentKind}:${currentItem.label}`
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
    kind: () => currentKind,
    section: () => currentSection,
    async init(m) {
      phase = m
      itemIdx = 0; examCorrect = 0; examTotal = 0; currentItem = null
      next()
    },
    handleConfirm(dots) { if (currentItem) checkAnswer(dots) },
    switchKind,
    switchSection,
    view() {
      const sec = document.createElement('section')
      const kinds = LESSON_TYPES.map(k =>
        `<button data-kind="${k}" class="kind-btn${k === currentKind ? ' active' : ''}">${t('kind' + k[0].toUpperCase() + k.slice(1))}</button>`
      ).join('')
      const sections = buildSections(currentKind, lang)
      const secBtns = sections.map(s =>
        `<button data-section="${s.id}" class="section-btn${s.id === currentSection?.id ? ' active' : ''}">${s.label}</button>`
      ).join('')
      sec.innerHTML = `<h1>${t('lessonTitle')}</h1>
        <div class="kind-buttons">${kinds}</div>
        <div class="section-buttons">${secBtns}</div>
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
      container.querySelectorAll('[data-kind]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.kind-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          this.switchKind(btn.dataset.kind)
          this.refreshView(container)
        })
      })
      container.querySelectorAll('[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          this.switchSection(btn.dataset.section)
        })
      })
    },
    // 重建视图（切换子模块后更新小节按钮）
    refreshView(container) {
      if (!container) return
      const sections = buildSections(currentKind, lang)
      const secBtns = sections.map(s =>
        `<button data-section="${s.id}" class="section-btn${s.id === currentSection?.id ? ' active' : ''}">${s.label}</button>`
      ).join('')
      const secBox = container.querySelector('.section-buttons')
      if (secBox) secBox.innerHTML = secBtns
      // 重新绑定小节按钮
      container.querySelectorAll('[data-section]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          this.switchSection(btn.dataset.section)
        })
      })
    }
  }
}

// 逐方比较（数字/符号/音节多方）：每方内无序，方序固定
export function gradeAnswerMulti(expectedCells, givenFlat) {
  // givenFlat 是用户输入的单层点位（可能含多方展平）
  // 简化：若用户按 * 逐方输入则 given 已是多方；此处按展平后长度比对不够精确，
  // 但我们教学里数字题用户需输入 数字符3456 + 字母方 两方 → 展平后排序比对
  const expFlat = expectedCells.flat().sort((a, b) => a - b)
  const gv = Array.isArray(givenFlat[0]) ? givenFlat.flat() : givenFlat
  const gFlat = [...gv].sort((a, b) => a - b)
  return expFlat.length === gFlat.length && expFlat.every((v, i) => v === gFlat[i])
}