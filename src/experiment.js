// src/experiment.js —— v4：AudioBraille 听觉识别实验（分步：按0听→输点位→按0提交）
// 用户设想：播放 AudioBraille 音频（左列=左耳/右列=右耳/上行600Hz/中行400Hz/下行250Hz/左正弦右方波），
// 测试人能否仅凭耳朵分辨出是哪个字母/哪组盲文点位。可行性测试，非考试。
// 流程（每步只做一件事，音频与语音不重叠）：
//   点击开始 → 短说明 → "第1题：按0播放音频"
//   按0（无点位）→ 播放音频 → "请用数字键输入点位，按0提交"
//   输入点位 → 按0（有点位）→ 判定："正确" / "错误，正确答案是X"
//   （停顿后）→ "第2题：按0播放音频" … 10 题 → 汇总
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS } from './braille-engine.js'

// 随机 n 个不重复字母（题源；每次从 a-z 随机抽 10）
export function pickTrialLetters(n = 10) {
  const keys = Object.keys(LATIN_LETTERS)
  const shuffled = [...keys].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// 生成随机点位集合（3-6 个不重复点；供测试）
export function createAudioTrial() {
  const n = 3 + Math.floor(Math.random() * 4)
  const pool = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5)
  return { dots: pool.slice(0, n).sort((a, b) => a - b) }
}

// 生成 n 个不重复点位题（供测试）
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

// 点位比较（顺序无关）
export function gradeDots(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// 实验数据模型
export function createExperiment() {
  const trials = []
  return {
    addTrial(dots, guess, timeSec, correct) {
      trials.push({ dots: [...dots], guess: [...guess], timeSec, correct })
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

export function summarize(exp) {
  return exp.summarize()
}

// UI 接线
export function initExperiment({ state, render }) {
  const exp = createExperiment()
  let stage = 'idle'        // idle | listen(按0听) | answer(输入点位) | done
  let current = null        // { letter, dots, startTime }
  let letters = []
  let idx = 0
  let lastHint = 0

  function setStatus(msg) {
    const el = document.querySelector('#exp-status')
    if (el) el.textContent = msg
  }

  function playCurrentAudio() {
    if (!current) return
    playAudioBraille(current.dots)
  }

  // 到下一题（等待用户按 0 听）
  function nextListen() {
    if (idx >= letters.length) {
      stage = 'done'
      const s = exp.summarize()
      const acc = Math.round(s.accuracy * 100)
      const msg = t('expDone', { accuracy: String(acc), time: s.avgTime.toFixed(1) })
      setStatus(msg)
      speak(msg)
      return
    }
    const letter = letters[idx]
    current = { letter, dots: LATIN_LETTERS[letter], startTime: null }
    stage = 'listen'
    setStatus(t('expListen', { label: String(idx + 1), total: String(letters.length) }))
    // 不自动播音频、不播长语音——等用户按 0
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
      letters = pickTrialLetters(10)
      idx = 0
      stage = 'listen'
      speak(t('expIntro'))
      nextListen()
    },
    // 按 0 统一入口（app.js 注入）：有点位=提交猜测；无点位=播放音频/开始
    handleKey0(dots) {
      if (stage === 'listen' && dots.length === 0) {
        // 听音频
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
        // 无点位再按 0：重听
        playCurrentAudio()
        return
      }
    },
    // 重听（+ 键）
    replay() { playCurrentAudio() }
  }

  function submitGuess(guessDots) {
    const correct = gradeDots(current.dots, guessDots)
    const elapsed = (performance.now() - current.startTime) / 1000
    exp.addTrial(current.dots, guessDots, elapsed, correct)
    if (correct) {
      speak(t('correct'))
      setStatus(t('correct'))
    } else {
      // 直接报对应字母，不把点位读成大数字
      speak(t('expWrong', { letter: current.letter }))
      setStatus(t('expWrong', { letter: current.letter }))
    }
    state.clearDots()
    // 停顿后再进下一题（防止语音与下一题音频重叠）
    idx++
    setTimeout(nextListen, 1600)
  }
}