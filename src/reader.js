// src/reader.js —— 听书：可调倍速 AudioBraille 朗读
import { playAudioBraille } from './audio-braille.js'
import { INITIALS, FINALS, syllableToDots, dotsToUnicode, unicodeToDots } from './braille-engine.js'

// 内置示例短文（拼音音节串，空格分隔；数字/声调用数字后缀）
export const SAMPLE_TEXT = 'ma ma he wo yi qi xue xi mang wen dian nao shi jie'

export function buildPassageSequence(passage = {}) {
  const cells = Array.isArray(passage.brailleCells) ? passage.brailleCells : buildReadingDots(passage.pinyin || passage.text || '')
  return cells.map(dots => [...dots])
}

export function createReaderTrialRecord({
  passageId = null,
  passageVersion = null,
  passageIndex = null,
  playStartedAt = null,
  playCompletedAt = null,
  playedDurationMs = null,
  completed = false,
  pauseCount = 0,
  replayCount = 0,
  playbackSpeed = 1,
  selfReportedUnderstood = null,
  summaryText = ''
} = {}) {
  const safeSummary = typeof summaryText === 'string' ? summaryText : ''
  return {
    passageTrialId: `${passageId || 'passage'}:${passageIndex ?? 0}:${playStartedAt ?? 'pending'}`,
    passageId,
    passageVersion,
    passageIndex,
    playStartedAt,
    playCompletedAt,
    playedDurationMs,
    completed: Boolean(completed),
    pauseCount: Math.max(0, Number(pauseCount) || 0),
    replayCount: Math.max(0, Number(replayCount) || 0),
    playbackSpeed: clampSpeed(playbackSpeed),
    selfReportedUnderstood,
    summaryText: safeSummary,
    summarySubmitted: safeSummary.trim().length > 0
  }
}

// 拼音或 Unicode 盲文 → 单方播放序列
const INITIAL_LIST = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']

// 音节 → 点位序列（可选声调数字后缀，如 "ma1"）
export function syllableToDotsSeq(syllable) {
  const m = String(syllable).match(/^([a-z]+)([1-4])?$/)
  if (!m) return []
  const pinyin = m[1]
  let tone = m[2] || null
  // 找声母（最长匹配）
  let initial = '', final = pinyin
  for (const ini of INITIAL_LIST) {
    if (pinyin.startsWith(ini) && pinyin.length > ini.length) {
      initial = ini; final = pinyin.slice(ini.length)
      break
    }
  }
  // 检查声母/韵母有效性（声母可空=韵母自成音节）
  if (initial && !INITIALS[initial]) return []
  if (!FINALS[final]) return []
  const seq = syllableToDots(initial || '', final, tone)
  return seq.map(d => [...d])
}

// 整句（空格分隔音节串）→ 点位序列
export function buildReadingDots(text) {
  const value = String(text).trim()
  const braille = [...value].filter(ch => {
    const code = ch.codePointAt(0)
    return code >= 0x2800 && code <= 0x28ff
  })
  if (braille.length > 0) return braille.map(unicodeToDots)
  return value.split(/\s+/).filter(Boolean).flatMap(w => syllableToDotsSeq(w))
}

export const SAMPLE_BRAILLE = buildReadingDots(SAMPLE_TEXT).map(dotsToUnicode).join('')
export function buildReaderComprehensionHtml({ completed = false, understood = null, summaryText = '' } = {}) {
  if (!completed) return '<p class="reader-comprehension-pending">播放完成后可填写理解反馈。</p>'
  const choices = `<div class="button-row"><button class="button button-success" data-action="reader-understood">听懂了</button><button class="button button-quiet" data-action="reader-not-understood">没听懂</button></div>`
  if (understood !== true) return `<section class="reader-comprehension"><h3>理解反馈</h3>${choices}</section>`
  return `<section class="reader-comprehension"><h3>理解反馈</h3>${choices}<label>普通文字概括<textarea id="reader-summary" data-field="reader-summary" rows="4">${escReaderText(summaryText)}</textarea></label><div class="button-row"><button class="button button-primary" data-action="reader-summary-submit">提交概括</button><button class="button button-quiet" data-action="reader-summary-skip">跳过概括</button></div></section>`
}

function escReaderText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}


// 速度限制（0.5x~5x）
export function clampSpeed(x) {
  const n = Number(x)
  if (isNaN(n)) return 1
  return Math.min(5, Math.max(0.5, n))
}

// 朗读控制器
export function createReader({ onTick = null, onComplete = null } = {}) {
  let speed = 1
  let playing = false
  let paused = false
  let pauseCount = 0
  let generation = 0
  let resumeWaiters = []
  let position = 0
  let total = 0
  function resumePaused() {
    paused = false
    const waiters = resumeWaiters
    resumeWaiters = []
    waiters.forEach(resolve => resolve())
  }
  return {
    setSpeed(s) { speed = clampSpeed(s) },
    getSpeed() { return speed },
    snapshot() { return { playing, paused, pauseCount, speed, position, total, generation } },
    async play(text) {
      if (playing) return
      const token = ++generation
      playing = true
      paused = false
      position = 0
      const seq = Array.isArray(text) ? text.map(dots => [...dots]) : buildReadingDots(text)
      total = seq.length
      for (let i = 0; i < seq.length; i += 1) {
        if (token !== generation) return
        if (paused) await new Promise(resolve => resumeWaiters.push(resolve))
        if (token !== generation) return
        const dur = Math.max(0.05, 0.5 / speed)
        await playAudioBraille(seq[i], { duration: dur })
        if (token !== generation) return
        position = i + 1
        onTick?.(position, total)
        await new Promise(resolve => setTimeout(resolve, 100 / speed))
      }
      if (token !== generation) return
      playing = false
      onComplete?.({ generation: token })
    },
    pause() {
      if (!playing || paused) return false
      paused = true
      pauseCount += 1
      return true
    },
    resume() {
      if (!paused) return false
      resumePaused()
      return true
    },
    stop() {
      generation += 1
      playing = false
      resumePaused()
    }
  }
}