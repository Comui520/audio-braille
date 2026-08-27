// src/teaching.js —— v7：四子模块 × 小节 × 学练考
// v7 架构修复：
//   1. 统一用 cells.js（toCells/gradeCells/keyHintForCells）替代本地猜测形态的函数
//   2. 教学提示加盲文明文展示（不只告诉键位，还展示字符长啥样）
//   3. 修复数字朗读（"1852" → "1 8 5 2" 避免 TTS 读成一千八百五十二）
//   4. 修复逐方判定（方序固定，不能展平蒙对）
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
import { toCells, gradeCells, keyHintForCells, cellsToUnicode, speakableDigits, cellCountLabel, cellsToDiagram } from './cells.js'

// 盲文方点阵图 HTML（v7：教学展示字符的盲文长啥样）
function diagramHtml(cells) {
  const cellsHtml = cellsToDiagram(cells).map(c => {
    const dots = c.dots.map((on, i) =>
      `<span class="bd-dot${on ? ' on' : ''}" style="grid-area:d${i + 1}"></span>`
    ).join('')
    return `<span class="bd-cell" aria-hidden="true">${dots}</span>`
  }).join('')
  return `<span class="braille-diagram">${cellsHtml}<span class="bd-unicode">${cellsToUnicode(cells)}</span></span>`
}

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
// v7：所有 dots 用 toCells 归一化为多方数组
// 每小节返回该组题目数组（用于顺序学习）
export function buildSections(kind, lang = 'zh') {
  if (kind === 'latin') {
    const letters = Object.keys(LATIN_LETTERS)
    return [
      { id: 'l1', label: 'a-h', items: letters.slice(0, 8).map(l => ({ type: 'letter', label: l, ch: l, cells: toCells(latinToDots(l)) })) },
      { id: 'l2', label: 'i-p', items: letters.slice(8, 16).map(l => ({ type: 'letter', label: l, ch: l, cells: toCells(latinToDots(l)) })) },
      { id: 'l3', label: 'q-z', items: letters.slice(16, 26).map(l => ({ type: 'letter', label: l, ch: l, cells: toCells(latinToDots(l)) })) }
    ]
  }
  if (kind === 'symbols') {
    const zhTable = SYMBOLS_CN, enTable = SYMBOLS_EN
    const zhNames = CN_SYMBOL_NAMES, enNames = EN_SYMBOL_NAMES
    return [
      {
        id: 's1', label: '中文符号',
        items: Object.keys(zhTable).map(ch => ({ type: 'symbol', label: zhNames[ch] || ch, ch, cells: toCells(zhTable[ch]) }))
      },
      {
        id: 's2', label: 'English symbols',
        items: Object.keys(enTable).map(ch => ({ type: 'symbol', label: enNames[ch] || ch, ch, cells: toCells(enTable[ch]) }))
      }
    ]
  }
  if (kind === 'digits') {
    return [{
      id: 'd1', label: '0-9',
      items: DIGITS.map(d => ({ type: 'digit', label: d, ch: d, cells: toCells([[3, 4, 5, 6], latinToDots(DIGIT_LETTER[d])]) }))
    }]
  }
  // pinyin：声母 / 韵母 / 带调音节
  const initials = Object.keys(INITIALS).filter(k => !['j', 'q', 'x'].includes(k))
  const finals = Object.keys(FINALS)
  return [
    {
      id: 'p1', label: '声母',
      items: initials.map(ini => ({ type: 'initial', label: ini, ch: ini, cells: toCells(INITIALS[ini]) }))
    },
    {
      id: 'p2', label: '韵母',
      items: finals.map(fin => ({ type: 'final', label: fin, ch: fin, cells: toCells(FINALS[fin]) }))
    },
    {
      id: 'p3', label: '带调音节',
      items: PINYIN_SYLLABLES.map(s => ({
        type: 'syllable', initial: s.initial, final: s.final, tone: s.tone,
        label: `${s.initial}${s.final}${TONE_NAMES[s.tone] || ''}`, ch: `${s.initial}${s.final}`,
        cells: toCells(syllableToDots(s.initial, s.final, s.tone))
      }))
    }
  ]
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

  function setLesson(msg, cells = null) {
    if (!lessonEl) return
    // v7：文字提示 + 盲文方点阵图（明眼人看得见，屏幕阅读器读文字）
    lessonEl.innerHTML = `<span class="lesson-text">${msg}</span>` + (cells ? diagramHtml(cells) : '')
  }

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
    const hint = keyHintForCells(currentItem.cells)
    const cellCount = currentItem.cells.length
    const countNote = cellCount > 1 ? `（${cellCountLabel(cellCount)}，每方打完按 * 进下一方）` : ''
    if (phase === 'learn') {
      // v7：键位逐位朗读（避免 TTS 把 1852 读成一千八百五十二）+ 展示盲文方点阵图
      speak(t('learnItem', { label: L, hint: speakableDigits(hint) }) + (cellCount > 1 ? `，${cellCountLabel(cellCount)}` : ''))
      setLesson(t('learnItem', { label: L, hint }) + countNote, currentItem.cells)
      // 学阶段同时逐方播 AudioBraille，建立“字符↔声音”关联
      playCells(currentItem.cells)
    } else if (phase === 'practice') {
      speak(t('practiceItem', { label: L }) + (cellCount > 1 ? `，${cellCountLabel(cellCount)}` : ''))
      // 练阶段：显示盲文图作为提示，但不给键位
      setLesson(t('practiceItem', { label: L }) + countNote, currentItem.cells)
    } else {
      // 考阶段：无任何提示（不显示盲文图）
      speak(t('q', { label: L }) + '，' + t('press0Submit'))
      setLesson(t('q', { label: L }) + '（' + t('press0Submit') + '）' + countNote)
    }
    state.clearDots()
    itemIdx++
  }

  // 逐方播放 AudioBraille（多方题不能一次传多层，否则静音）
  function playCells(cells) {
    toCells(cells).forEach((cell, i) => {
      setTimeout(() => playAudioBraille(cell, { duration: 0.35 }), 900 + i * 500)
    })
  }

  function checkAnswer(dots) {
    if (!currentItem) return
    // v7：统一用 gradeCells（方序固定，不能展平蒙对）
    const correct = gradeCells(currentItem.cells, dots)
    const key = `${currentKind}:${currentItem.label}`
    const answered = currentItem   // next() 会改 currentItem，先抓住
    if (correct) {
      speak(t('correct'))
      setLesson(t('correct') + ' ✓ ' + answered.label, answered.cells)
      reviewer.record(key, true)
      if (phase === 'exam') { examCorrect++; examTotal++ }
    } else {
      const hint = keyHintForCells(answered.cells)
      // v7：错误反馈键位逐位朗读 + 展示正确盲文图
      speak(t('wrongAnswer', { expected: `${answered.label}，键位 ${speakableDigits(hint)}` }))
      setLesson(t('wrongAnswer', { expected: `${answered.label}（键位：${hint}）` }), answered.cells)
      reviewer.record(key, false)
      if (phase === 'exam') { examTotal++ }
    }
    state.clearDots()
    // v7：错题多停一会儿，让用户看清正确答案（旧：400ms 太快，且语音被下一题打断）
    setTimeout(next, correct ? 900 : 2600)
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

