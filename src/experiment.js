// src/experiment.js —— v2：AudioBraille 听觉实验（独立模块，听音频辨字母）
// 核心设想：比较"语音朗读字母"与"AudioBraille 空间音频"两种听字母方式，收集可行性数据
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots, dotsToLatin } from './braille-engine.js'

// 随机生成 n 个不重复字母
export function pickTrialLetters(n = 10) {
  const keys = Object.keys(LATIN_LETTERS)
  const shuffled = [...keys].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export function createExperiment({ order = 'AB' } = {}) {
  const trials = []
  return {
    order,
    addTrial(group, timeSec, correct) {
      trials.push({ group, timeSec, correct })
    },
    trials() { return [...trials] }
  }
}

// 汇总统计
export function summarize(exp) {
  const groups = { tts: [], ab: [] }
  for (const t of exp.trials()) groups[t.group].push(t)
  const calc = (arr) => arr.length === 0
    ? { avgTime: 0, accuracy: 0, count: 0 }
    : {
        avgTime: arr.reduce((a, t) => a + t.timeSec, 0) / arr.length,
        accuracy: arr.filter(t => t.correct).length / arr.length,
        count: arr.length
      }
  return { tts: calc(groups.tts), ab: calc(groups.ab) }
}

// 结果播报文案（屏幕 + TTS）——兼容传入 experiment 实例或 summarize 结果
export function formatResult(exp) {
  const s = typeof exp.trials === 'function' ? summarize(exp) : exp
  const ttsAcc = Math.round(s.tts.accuracy * 100)
  const abAcc = Math.round(s.ab.accuracy * 100)
  const ttsTime = s.tts.avgTime.toFixed(1)
  const abTime = s.ab.avgTime.toFixed(1)
  return t('expDone', { accuracy: `${ttsAcc}`, time: `${ttsTime}`, accuracy2: `${abAcc}`, time2: `${abTime}` })
}

// UI 接线（由 app.js 调用）
export function initExperiment({ state, render }) {
  const exp = createExperiment({ order: 'AB' })
  // 实验流程状态
  let stage = 'idle'        // idle | confirm | ttsTrials | abTrials | done
  let currentTrial = null   // { group, letter, startTime }
  let letters = []
  let idx = 0

  function setStatus(msg) {
    const el = document.querySelector('#exp-status')
    if (el) el.textContent = msg
  }

  function nextTrial() {
    if (stage === 'ttsTrials' && idx < 10) {
      const letter = letters[idx]
      currentTrial = { group: 'tts', letter, startTime: performance.now() }
      speak(t('expTrialA', { label: String(idx + 1) }) + ` ${letter}`)
      setStatus(`A 组第 ${idx + 1}/10 题：请打出字母 ${letter}`)
      return
    }
    if (stage === 'ttsTrials' && idx >= 10) {
      // 进入 B 组
      stage = 'abTrials'
      idx = 0
      letters = pickTrialLetters()
      speak(t('expBStart'))
      setStatus('B 组开始：听音频识别字母')
      return
    }
    if (stage === 'abTrials' && idx < 10) {
      const letter = letters[idx]
      currentTrial = { group: 'ab', letter, startTime: performance.now() }
      speak(t('expTrialB', { label: String(idx + 1) }))
      playAudioBraille(latinToDots(letter) ?? [])
      setStatus(`B 组第 ${idx + 1}/10 题：请听音频识别字母`)
      return
    }
    if (stage === 'abTrials' && idx >= 10) {
      // 结束
      stage = 'done'
      const result = formatResult(exp)
      setStatus(result)
      speak(result)
      return
    }
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
      stage = 'confirm'
      letters = pickTrialLetters()
      speak(t('expIntro'))
      setStatus(t('expConfirm'))
    },
    // 供 app.js 按 0 时调用
    handleConfirm(dots) {
      if (stage === 'confirm') {
        stage = 'ttsTrials'
        idx = 0
        speak(t('expAStart'))
        setStatus('A 组开始')
        nextTrial()
        return
      }
      if (stage === 'ttsTrials' || stage === 'abTrials') {
        // 判定：dots 与当前字母点位比较
        const expected = latinToDots(currentTrial?.letter) ?? []
        const correct = gradeDots(expected, dots)
        const elapsed = ((performance.now() - currentTrial.startTime) / 1000)
        exp.addTrial(currentTrial.group, elapsed, correct)
        const r = correct ? t('correct') : t('wrongAnswer', { expected: currentTrial.letter })
        speak(r)
        idx++
        setTimeout(nextTrial, 500)
        return
      }
    }
  }
}

// 点位比较（无序）
function gradeDots(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}
