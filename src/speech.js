// src/speech.js —— speak 封装（独立模块，供 app/input/notes/teaching/experiment 共用）
// 语言由 i18n 设置驱动：zh-CN / en-US
import { getLang } from './i18n.js'

export function speak(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = getLang() === 'en' ? 'en-US' : 'zh-CN'
  u.rate = rate
  u.pitch = pitch
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
