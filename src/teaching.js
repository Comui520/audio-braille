// src/teaching.js
import { speak } from './speech.js'

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

// ===== 教学数据 =====
// 声母 → 名称音（自成音节时的读法，如 zh → zhī）
const INITIAL_NAMES = {
  b: 'bō', p: 'pō', m: 'mō', f: 'fō', d: 'dē', t: 'tē', n: 'nē', l: 'lē',
  g: 'gē', k: 'kē', h: 'hē', zh: 'zhī', ch: 'chī', sh: 'shī', r: 'rī',
  z: 'zī', c: 'cī', s: 'sī'
}

// 教学题库：声母 + 常用韵母（无调模式基础课）
export const LESSON_INITIALS = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's']
export const LESSON_FINALS = ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng']

// 带调测试的常用音节（声母+韵母+声调）
export const LESSON_SYLLABLES = [
  { initial: 'm', final: 'a', tone: '1' },   // mā
  { initial: 'b', final: 'a', tone: '1' },   // bā
  { initial: 'h', final: 'ao', tone: '3' },  // hǎo
  { initial: 'n', final: 'i', tone: '3' },   // nǐ
  { initial: 'l', final: 'e', tone: '4' },   // lè
  { initial: 'd', final: 'a', tone: '1' },   // dā
  { initial: 'g', final: 'e', tone: '1' },   // gē
  { initial: 'h', final: 'e', tone: '2' },   // hé
  { initial: 'sh', final: 'i', tone: '4' },  // shì
  { initial: 'z', final: 'ao', tone: '3' }   // zǎo
]

// 带调拼音字符串（ma1 → mā）
const TONE_MARKS = { '1': 'āēīōūǖ', '2': 'áéíóúǘ', '3': 'ǎěǐǒǔǚ', '4': 'àèìòùǜ' }
export function toneToMarked(final, tone) {
  if (!tone) return final
  // 找韵母主元音：优先 a/o/e，其次 i/u/ü
  const vowels = 'aeiouv'
  let target = -1
  for (let i = 0; i < final.length; i++) {
    if ('aoe'.includes(final[i])) { target = i; break }
  }
  if (target === -1) {
    for (let i = 0; i < final.length; i++) {
      if ('iuv'.includes(final[i])) { target = i; break }
    }
  }
  if (target === -1) return final
  const ch = final[target]
  const idx = 'aeiouv'.indexOf(ch)
  const marks = TONE_MARKS[tone] ?? ''
  return final.slice(0, target) + marks[idx] + final.slice(target + 1)
}

// 完整带调拼音
export function syllableLabel({ initial, final, tone }) {
  const pinyin = (initial || '') + final
  return toneToMarked(pinyin, tone)
}

// —— 教学 UI（探索/考试，键盘驱动）——
// 由 app.js 调用；依赖 state/render/speak/playAudioBraille
export function initTeaching({ state, render, storage }) {
  const reviewer = createReviewer()
  // 当前课程状态
  let mode = 'explore'          // explore | exam
  let withTone = false          // 初级无调 / 进阶带调
  let currentItem = null        // 当前题目 {type, label, initial, final, tone, dots}
  let examIndex = 0             // 考试题号
  let examCorrect = 0           // 考试答对次数
  let examTotal = 0             // 考试总题数（10 题一轮）
  let lessonEl = null           // 出题区 DOM

  const engine = { INITIALS: null, FINALS: null, TONES: null, syllableToDots: null }

  // 引入引擎（延迟 require 避免循环依赖：teaching ← braille-engine）
  async function loadEngine() {
    if (!engine.INITIALS) {
      const m = await import('./braille-engine.js')
      engine.INITIALS = m.INITIALS
      engine.FINALS = m.FINALS
      engine.TONES = m.TONES
      engine.syllableToDots = m.syllableToDots
    }
  }

  // —— 出题 ——
  function pickItem() {
    if (mode === 'explore') {
      // 探索：随机声母或韵母（可带调）
      if (Math.random() < 0.5) {
        const i = LESSON_INITIALS[Math.floor(Math.random() * LESSON_INITIALS.length)]
        return { type: 'initial', label: INITIAL_NAMES[i] ?? i, initial: i, dots: engine.INITIALS[i] }
      } else {
        const f = LESSON_FINALS[Math.floor(Math.random() * LESSON_FINALS.length)]
        return { type: 'final', label: f, final: f, dots: engine.FINALS[f] }
      }
    } else {
      // 考试：错题优先（每 5 题插 1），否则随机带调音节
      const q = pickExamQuestion({ index: examIndex, reviewQueue: reviewer.reviewQueue() })
      if (q) {
        // 从错题 key 还原题目（key 存 initial+final+tone）
        const [init, fin, tone] = q.split('|')
        return { type: 'syllable', label: syllableLabel({ initial: init, final: fin, tone: tone || null }), initial: init, final: fin, tone: tone || null, dots: engine.syllableToDots(init, fin, tone || null) }
      }
      const s = LESSON_SYLLABLES[Math.floor(Math.random() * LESSON_SYLLABLES.length)]
      return { type: 'syllable', label: syllableLabel(s), ...s, dots: engine.syllableToDots(s.initial, s.final, s.tone) }
    }
  }

  // —— 核对答案（按 0 时调用）——
  function checkAnswer(dots) {
    if (!currentItem) return
    const correct = gradeAnswer(currentItem.dots, dots)
    if (correct) {
      speak('正确')
      reviewer.record(currentKey(), true)
      if (mode === 'exam') { examCorrect++; examTotal++ }
    } else {
      // currentItem.dots 是 [ [1,2], [3,5], [1] ]（多方），需逐方描述
      const expectStr = currentItem.dots.map(d => (d.length ? `点${d.join('、点')}` : '空')).join('，')
      speak(`错误，正确答案是${expectStr}`)
      reviewer.record(currentKey(), false)
      if (mode === 'exam') { examTotal++ }
    }
    state.clearDots()
    // 下一题
    setTimeout(next, 400)
  }

  function currentKey() {
    if (!currentItem) return ''
    return [currentItem.initial, currentItem.final, currentItem.tone].filter(Boolean).join('|')
  }

  function setLesson(msg) {
    if (lessonEl) lessonEl.textContent = msg
  }

  // —— 下一题 / 结束 ——
  function next() {
    if (mode === 'exam' && examTotal >= 10) {
      const acc = Math.round((examCorrect / examTotal) * 100)
      speak(`考试结束，共${examTotal}题，答对${examCorrect}题，正确率${acc}%`)
      setLesson(`考试结束：${examCorrect}/${examTotal}，正确率 ${acc}%`)
      examIndex = 0; examCorrect = 0; examTotal = 0
      return
    }
    currentItem = pickItem()
    if (mode === 'explore') {
      speak(`请探索字符 ${currentItem.label}，按 0 核对`)
    } else {
      speak(`第${examTotal + 1}题，请打出 ${currentItem.label}，按 0 提交`)
    }
    setLesson(mode === 'explore' ? `请探索字符 ${currentItem.label}（按点位键，0 核对）` : `第${examTotal + 1}题：请打出 ${currentItem.label}`)
    state.clearDots()
  }

  return {
    reviewer,
    mode: () => mode,
    withTone: () => withTone,
    currentItem: () => currentItem,
    async init(m) {
      mode = m
      examIndex = 0; examCorrect = 0; examTotal = 0
      await loadEngine()
      currentItem = null
      next()
    },
    // 供 app.js 在按 0 时调用
    handleConfirm(dots) {
      if (currentItem) checkAnswer(dots)
    },
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>教学</h1><button data-mode="explore">探索模式</button><button data-mode="exam">考试模式</button><div id="lesson" aria-live="polite"></div>'
      return sec
    },
    bind(container) {
      lessonEl = container.querySelector('#lesson')
      container.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => { void this.init(btn.dataset.mode) })
      })
    }
  }
}
