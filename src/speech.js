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
    // 使用较长兜底，仅防止极少数浏览器不派发 onend；正常结束以 onend 为准。
    setTimeout(finish, Math.max(5000, String(text).length * 500))
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
