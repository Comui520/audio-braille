// src/teaching.js —— v2：学→练→考 三阶段教学（英文优先）
// 核心：教学要教会不会的人——先学（名称+音频+点位展示），再练（有提示出题），后考（考核+错题复习）
import { speak } from './speech.js'
import { t, getLang } from './i18n.js'
import { LATIN_LETTERS, latinToDots, dotsToLatin, latinToUnicode } from './braille-engine.js'
import { playAudioBraille } from './audio-braille.js'

// —— 间隔重复错题本（纯逻辑，可测）——
// 规则：错误≥2 加入；每 5 题插 1 错题；连续正确 3 次移出。
export function createReviewer() {
  const map = new Map()   // key → { errors, streak }

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

// —— 考试出题（纯逻辑）——
// 每 5 题（index%5===4）强制插入错题本中的题目
export function pickExamQuestion({ index, reviewQueue }) {
  if (index % 5 === 4 && reviewQueue.length > 0) {
    return reviewQueue[index % reviewQueue.length]
  }
  return null   // 返回 null 表示从常规题库随机出题（UI 层处理）
}

// —— 评分（点位数组无序比较）——
export function gradeAnswer(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// —— 出题（纯逻辑，可测）——
// alphabet: 教学字母表（英文：abcdefghijklmnopqrstuvwxyz）
// phase: learn(学) | practice(练) | exam(考)
// index: 当前题号（从 0 开始）
export function pickItem({ phase, alphabet, index }) {
  const letters = alphabet || 'abcdefghijklmnopqrstuvwxyz'
  const letter = letters[index % letters.length]
  const dots = latinToDots(letter)
  return { type: 'letter', label: letter, latin: letter, dots, phase }
}

export function isLearnPhase(phase) {
  return phase === 'learn'
}

// —— 教学 UI（学→练→考，键盘驱动）——
// 由 app.js 调用；依赖 state/render/speak/playAudioBraille
export function initTeaching({ state, render, storage }) {
  const reviewer = createReviewer()
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
  // 当前课程状态
  let phase = 'learn'           // learn | practice | exam
  let currentItem = null        // 当前题目 {type, label, latin, dots}
  let examIndex = 0             // 考试题号（0..9）
  let examCorrect = 0
  let examTotal = 0             // 10 题一轮
  let lessonEl = null           // 出题区 DOM

  // —— 出题 ——
  function pick() {
    if (phase === 'exam') {
      // 考试：错题优先（每 5 题插 1），否则按顺序出字母
      const q = pickExamQuestion({ index: examIndex, reviewQueue: reviewer.reviewQueue() })
      if (q) {
        const letter = q.replace('letter:', '')
        const dots = latinToDots(letter)
        return { type: 'letter', label: letter, latin: letter, dots, phase }
      }
      return pickItem({ phase, alphabet: ALPHABET, index: examIndex })
    }
    // 学/练：按字母表顺序学习
    const idx = currentItem ? ALPHABET.indexOf(currentItem.label) + 1 : 0
    return pickItem({ phase, alphabet: ALPHABET, index: idx % 26 })
  }

  // —— 下一题 / 结束 ——
  function next() {
    if (phase === 'exam' && examTotal >= 10) {
      const acc = Math.round((examCorrect / examTotal) * 100)
      speak(t('examOver', { accuracy: acc }))
      setLesson(t('examOver', { accuracy: acc }))
      examIndex = 0; examCorrect = 0; examTotal = 0
      return
    }
    currentItem = pick()
    if (phase === 'learn') {
      speak(`${t('learnItem', { label: currentItem.label })}，${t('press0Check')}`)
      setLesson(`${t('learnItem', { label: currentItem.label })}（${t('press0Check')}）`)
    } else if (phase === 'practice') {
      speak(`${t('practiceItem', { label: currentItem.label })}`)
      setLesson(`${t('practiceItem', { label: currentItem.label })}`)
    } else {
      speak(`${t('q', { label: currentItem.label })}，${t('press0Submit')}`)
      setLesson(`${t('q', { label: currentItem.label })}（${t('press0Submit')}）`)
    }
    // 学阶段：播放音频 + 显示点位
    if (phase === 'learn') {
      playAudioBraille(currentItem.dots)
    }
    state.clearDots()
  }

  // —— 核对答案（按 0 时调用）——
  function checkAnswer(dots) {
    if (!currentItem) return
    const correct = gradeAnswer(currentItem.dots, dots)
    const key = `letter:${currentItem.label}`
    if (correct) {
      speak(t('correct'))
      reviewer.record(key, true)
      if (phase === 'exam') { examCorrect++; examTotal++ }
    } else {
      speak(t('wrongAnswer', { expected: currentItem.label }))
      reviewer.record(key, false)
      if (phase === 'exam') { examTotal++ }
    }
    state.clearDots()
    setTimeout(next, 400)
  }

  function setLesson(msg) {
    if (lessonEl) lessonEl.textContent = msg
  }

  return {
    reviewer,
    phase: () => phase,
    currentItem: () => currentItem,
    async init(m) {
      phase = m
      examIndex = 0; examCorrect = 0; examTotal = 0
      currentItem = null
      next()
    },
    // 供 app.js 在按 0 时调用
    handleConfirm(dots) {
      if (currentItem) checkAnswer(dots)
    },
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
