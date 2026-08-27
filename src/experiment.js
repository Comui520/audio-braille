// src/experiment.js —— v3：AudioBraille 听觉识别实验（独立模块）
// 核心设想（用户原话）：把盲文点位按规则编码成音频——左列点=左声道、右列点=右声道，
// 音高按行（上行600Hz/中行400Hz/下行250Hz）、波形左正弦右方波。
// 播放一段"音频指纹"，测试人能否仅凭耳朵分辨出对应的盲文点位（1-6 数字串）。
// 这是一个可行性测试，不是考试：播放 → 听 → 用键盘数字键猜 → 记录对错/耗时 → 汇总正确率。
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'
import { t } from './i18n.js'

// 生成随机点位集合（3-6 个不重复点）
export function createAudioTrial() {
  const n = 3 + Math.floor(Math.random() * 4)   // 3~6
  const pool = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5)
  return { dots: pool.slice(0, n).sort((a, b) => a - b) }
}

// 生成 n 个不重复题目（按点位串去重）
export function pickTrialDots(n = 10) {
  const seen = new Set()
  const out = []
  while (out.length < n) {
    const t = createAudioTrial()
    const key = t.dots.join(',')
    if (!seen.has(key)) { seen.add(key); out.push(t.dots) }
  }
  return out
}

// 点位比较（顺序无关）
export function gradeDots(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// 实验数据模型：每轮记录 { dots, guess, correct, timeSec }
export function createExperiment() {
  const trials = []
  return {
    addTrial(dots, guess, timeSec, correct) {
      trials.push({ dots: [...dots], guess: [...guess], timeSec, correct })
    },
    trials() { return [...trials] },
    summarize() {
      const n = trials.length
      const correct = trials.filter(t => t.correct).length
      const avgTime = n ? trials.reduce((a, t) => a + t.timeSec, 0) / n : 0
      return { count: n, accuracy: n ? correct / n : 0, avgTime }
    }
  }
}

export function summarize(exp) {
  return exp.summarize()
}
export function initExperiment({ state, render }) {
  const exp = createExperiment()
  let stage = 'idle'        // idle | confirm | trials | done
  let current = null        // { dots, startTime }
  let trials = []
  let idx = 0

  function setStatus(msg) {
    const el = document.querySelector('#exp-status')
    if (el) el.textContent = msg
  }

  function playCurrent() {
    if (!current) return
    // 用 AudioBraille 编码播放（音高/波形/左右声道）
    playAudioBraille(current.dots)
  }

  function nextTrial() {
    if (idx >= trials.length) {
      stage = 'done'
      const s = exp.summarize()
      const acc = Math.round(s.accuracy * 100)
      const msg = t('expDone', { accuracy: String(acc), time: s.avgTime.toFixed(1) })
      setStatus(msg)
      speak(msg)
      return
    }
    current = { dots: trials[idx], startTime: performance.now() }
    // 用 1-6 数字串描述答案（盲文点号），避免播报数字符号
    const answerLabel = current.dots.join('')
    setStatus(`第 ${idx + 1}/${trials.length} 题：请听音频，用数字键猜点位（如 7 1 8 5）`)
    // 播放音频（可重听：按 + 再播）
    setTimeout(playCurrent, 300)
  }

  return {
    exp,
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `<h1>${t('expTitle')}</h1>
        <button data-exp="start">${t('expStart')}</button>
        <div id="exp-status" aria-live="polite"></div>`
      return sec
    },
    bind(container) {
      container.querySelector('[data-exp="start"]')?.addEventListener('click', () => this.start())
    },
    start() {
      trials = pickTrialDots(10)
      stage = 'confirm'
      const msg = t('expConfirm')
      setStatus(msg)
      speak(msg)
    },
    // 按 0 确认开始（app.js 注入）
    handleConfirm() {
      if (stage !== 'confirm') return
      stage = 'trials'
      idx = 0
      speak(t('expIntro'))
      nextTrial()
    },
    // 提交猜测（app.js/input.js 在数字键时调用）
    submitGuess(guessDots) {
      if (stage !== 'trials' || !current) return
      const correct = gradeDots(current.dots, guessDots)
      const elapsed = (performance.now() - current.startTime) / 1000
      exp.addTrial(current.dots, guessDots, elapsed, correct)
      speak(correct ? t('correct') : t('wrongAnswer', { expected: current.dots.join('') }))
      idx++
      setTimeout(nextTrial, 600)
    },
    // 重听当前音频
    replay() { playCurrent() }
  }
}