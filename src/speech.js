// src/speech.js —— speak 封装（独立模块，供 app/input/notes/teaching 共用）
export function speak(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  u.rate = rate
  u.pitch = pitch
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
