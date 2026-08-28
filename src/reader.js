// src/reader.js —— 听书：可调倍速 AudioBraille 朗读
import { playAudioBraille } from './audio-braille.js'
import { INITIALS, FINALS, TONES, syllableToDots } from './braille-engine.js'

// 内置示例短文（拼音音节串，空格分隔；数字/声调用数字后缀）
export const SAMPLE_TEXT = 'ma ma he wo yi qi xue xi mang wen dian nao shi jie'

// 拼音声母表（按长度降序，先匹配复声母）
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
  return String(text).trim().split(/\s+/).filter(Boolean).flatMap(w => syllableToDotsSeq(w))
}

// 速度限制（0.5x~5x）
export function clampSpeed(x) {
  const n = Number(x)
  if (isNaN(n)) return 1
  return Math.min(5, Math.max(0.5, n))
}

// 朗读控制器
export function createReader({ onTick = null } = {}) {
  let speed = 1
  let playing = false
  let stopFlag = false
  let position = 0
  let total = 0
  return {
    setSpeed(s) { speed = clampSpeed(s) },
    getSpeed() { return speed },
    snapshot() { return { playing, speed, position, total } },
    async play(text) {
      if (playing) return
      playing = true
      stopFlag = false
      position = 0
      const seq = buildReadingDots(text)
      total = seq.length
      for (let i = 0; i < seq.length; i++) {
        if (stopFlag) break
        const dur = Math.max(0.05, 0.5 / speed)
        await playAudioBraille(seq[i], { duration: dur })
        position = i + 1
        onTick?.(position, total)
        await new Promise(r => setTimeout(r, 100 / speed))
      }
      playing = false
    },
    stop() { stopFlag = true; playing = false }
  }
}