// src/experiment.js
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'

// 实验：A 组（TTS 朗读字母名）vs B 组（AudioBraille 空间音频，不显示文字）
// 前置条件：B 组前确认用户已掌握编码（UI 提示）
// 设计：随机 10 题；耗时口径 = 从播放结束到作答；交叉/随机组序

// 拉丁字母盲文点位表（国际标准，与现行盲文声母同源；实验题目用）
export const LATIN_LETTERS = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
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

// 结果播报文案（屏幕 + TTS）
export function formatResult(s) {
  return `语音组 ${s.tts.avgTime.toFixed(1)} 秒，AudioBraille 组 ${s.ab.avgTime.toFixed(1)} 秒；正确率语音组 ${Math.round(s.tts.accuracy * 100)}%，AudioBraille 组 ${Math.round(s.ab.accuracy * 100)}%`
}

// UI 接线（由 app.js 调用）
export function initExperiment({ state, render }) {
  const exp = createExperiment({ order: 'AB' })
  // 实验流程状态
  let stage = 'idle'        // idle | confirm | ttsTrials | abTrials | done
  let currentTrial = null   // { group, letter, startTime }
  let letters = []          // 随机 10 个字母
  let idx = 0

  function pickLetters(n = 10) {
    const keys = Object.keys(LATIN_LETTERS)
    const shuffled = [...keys].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  function setStatus(msg) {
    const el = document.querySelector('#exp-status')
    if (el) el.textContent = msg
  }

  function nextTrial() {
    if (stage === 'ttsTrials' && idx < 10) {
      const letter = letters[idx]
      currentTrial = { group: 'tts', letter }
      speak(`请打出字母 ${letter}`)
      setStatus(`A 组第 ${idx + 1}/10 题：请打出字母 ${letter}`)
      return
    }
    if (stage === 'ttsTrials' && idx >= 10) {
      // 进入 B 组
      stage = 'abTrials'
      idx = 0
      letters = pickLetters()
      speak('B 组开始。请听 AudioBraille 空间音频识别字母，用盲文点位作答。按 0 提交。')
      setStatus('B 组开始：听音频识别字母')
      return
    }
    if (stage === 'abTrials' && idx < 10) {
      const letter = letters[idx]
      currentTrial = { group: 'ab', letter }
      speak('请听音频')
      playAudioBraille(LATIN_LETTERS[letter] ?? [])
      setStatus(`B 组第 ${idx + 1}/10 题：请听音频识别字母`)
      return
    }
    if (stage === 'abTrials' && idx >= 10) {
      // 结束
      stage = 'done'
      const result = exp.finish()
      setStatus(result)
      speak(result)
      return
    }
  }

  return {
    exp,
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>实验模式</h1><button data-exp="start">开始实验</button><div id="exp-status" aria-live="polite"></div>'
      return sec
    },
    bind(container) {
      container.querySelector('[data-exp="start"]')?.addEventListener('click', () => this.start())
    },
    start() {
      stage = 'confirm'
      letters = pickLetters()
      speak('实验开始。请确认您已掌握 AudioBraille 编码，再按 0 继续。')
      setStatus('请按 0 确认开始')
    },
    // 供 app.js 按 0 时调用
    handleConfirm(dots) {
      if (stage === 'confirm') {
        stage = 'ttsTrials'
        idx = 0
        speak('A 组开始。请用盲文点位打出听到的字母。')
        setStatus('A 组开始')
        nextTrial()
        return
      }
      if (stage === 'ttsTrials' || stage === 'abTrials') {
        // 判定：dots 与当前字母点位比较
        const expected = LATIN_LETTERS[currentTrial?.letter] ?? []
        const correct = gradeDots(expected, dots)
        const elapsed = ((performance.now() - currentTrial.startTime) / 1000)
        exp.addTrial(currentTrial.group, elapsed, correct)
        const r = correct ? '正确' : `错误，正确答案是 ${currentTrial.letter}`
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
