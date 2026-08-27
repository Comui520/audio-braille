// src/teaching.js —— v3：学→练→考（英文优先，明确反馈）
// 学：告诉"要输入 a 就按 7"（键位 → 字母 逐点教学）
// 练：出题"打出 a"，按点位 → 实时说当前组合对应的字母 → 0 提交判定
// 考：出题（顺序字母/随机），0 提交 → 判定 + 错题复习
import { speak } from './speech.js'
import { t, getLang } from './i18n.js'
import { LATIN_LETTERS, latinToDots, dotsToLatin, latinToUnicode } from './braille-engine.js'
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

// 出题：学/练按顺序；考：错题优先 + 随机
export function pickItem({ phase, alphabet, index, reviewQueue }) {
  const letters = alphabet || 'abcdefghijklmnopqrstuvwxyz'
  if (phase === 'exam' && reviewQueue && reviewQueue.length > 0) {
    const q = pickExamQuestion({ index, reviewQueue })
    if (q) {
      const letter = q.replace('letter:', '')
      return { type: 'letter', label: letter, latin: letter, dots: latinToDots(letter), phase }
    }
  }
  const letter = letters[index % letters.length]
  return { type: 'letter', label: letter, latin: letter, dots: latinToDots(letter), phase }
}

// 键位 → 字母 教学提示（学阶段：教"想输入 a 按 7"）
// 官方键位：7=点1, 4=点2, 1=点3, 8=点4, 5=点5, 2=点6
export function keyHintForDots(dots) {
  const KEY_FOR_DOT = { 1: '7', 2: '4', 3: '1', 4: '8', 5: '5', 6: '2' }
  return dots.map(d => KEY_FOR_DOT[d]).join('、')
}

// —— 教学 UI ——
export function initTeaching({ state, render, storage }) {
  const reviewer = createReviewer()
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
  let phase = 'learn'
  let currentItem = null
  let learnIndex = 0
  let examIndex = 0
  let examCorrect = 0
  let examTotal = 0
  let lessonEl = null

  function setLesson(msg) { if (lessonEl) lessonEl.textContent = msg }

  function next() {
    if (phase === 'exam' && examTotal >= 10) {
      const acc = Math.round((examCorrect / examTotal) * 100)
      const msg = t('examOver', { accuracy: String(acc) })
      speak(msg)
      setLesson(msg)
      examIndex = 0; examCorrect = 0; examTotal = 0
      return
    }
    currentItem = pickItem({ phase, alphabet: ALPHABET, index: phase === 'learn' ? learnIndex : examIndex, reviewQueue: phase === 'exam' ? reviewer.reviewQueue() : [] })
    const L = currentItem.label
    if (phase === 'learn') {
      // 教：说明键位 → 字母
      const hint = keyHintForDots(currentItem.dots)
      speak(t('learnItem', { label: L, hint }))
      setLesson(`${t('learnItem', { label: L, hint })}`)
    } else if (phase === 'practice') {
      speak(`${t('practiceItem', { label: L })}`)
      setLesson(`${t('practiceItem', { label: L })}`)
    } else {
      speak(`${t('q', { label: L })}，${t('press0Submit')}`)
      setLesson(`${t('q', { label: L })}（${t('press0Submit')}）`)
    }
    state.clearDots()
    if (phase === 'learn') learnIndex++   // 学阶段：按 0 自动进下一字母
  }

  function checkAnswer(dots) {
    if (!currentItem) return
    const correct = gradeAnswer(currentItem.dots, dots)
    const key = `letter:${currentItem.label}`
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
    async init(m) {
      phase = m
      learnIndex = 0
      examIndex = 0; examCorrect = 0; examTotal = 0
      currentItem = null
      next()
    },
    handleConfirm(dots) { if (currentItem) checkAnswer(dots) },
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `<h1>${t('lessonTitle')}</h1>
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
