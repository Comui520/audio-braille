// src/speech.js —— speak 封装（独立模块，供 app/input/notes/teaching/experiment 共用）
// 语言由 i18n 设置驱动：zh-CN / en-US
import { getLang } from './i18n.js'

export function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function speakAndWait(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = getLang() === 'en' ? 'en-US' : 'zh-CN'
    u.rate = rate
    u.pitch = pitch
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    cancelSpeech()
    window.speechSynthesis.speak(u)
    // 语音结束事件是主同步信号；极慢或不派发事件的浏览器使用 12 秒兜底。
    setTimeout(finish, Math.max(12000, String(text).length * 700))
  })
}

export function speak(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = getLang() === 'en' ? 'en-US' : 'zh-CN'
  u.rate = rate
  u.pitch = pitch
  cancelSpeech()
  window.speechSynthesis.speak(u)
}
