// src/teaching-speech.js —— v9：可预测的教学语音文案
// 浏览器 Web Speech 对孤立的 b、a、ü 等拼音符号解释不一致，教学语音统一使用描述。
function pointText(cells, lang) {
  return cells.map(cell => {
    const points = cell.map(dot => lang === 'en' ? `dot ${dot}` : `点${dot}`).join(lang === 'en' ? ', ' : '、')
    return lang === 'en' ? points : points
  }).join(lang === 'en' ? '; ' : '；')
}

function cellCount(cells, lang) {
  if (cells.length <= 1) return ''
  return lang === 'en' ? `, ${cells.length} cells` : `，${cells.length}方`
}

export function buildTeachingSpeech(item, lang = 'zh') {
  const label = item.label ?? ''
  const dots = pointText(item.cells || [], lang)
  const count = cellCount(item.cells || [], lang)

  if (lang === 'en') {
    if (item.type === 'initial') return `Initial, screen label ${label}, braille ${dots}${count}`
    if (item.type === 'final') return `Final, screen label ${label}, braille ${dots}${count}`
    if (item.type === 'syllable') return `Syllable ${label}, ${item.toneName || 'unstressed'}; braille ${dots}${count}`
    if (item.type === 'letter') return `English letter ${label}, braille ${dots}`
    if (item.type === 'digit') return `Digit ${label}, number sign and digit cell: ${dots}`
    return `Symbol ${label}, braille ${dots}${count}`
  }

  if (item.type === 'initial') return `声母，界面文字是 ${label}，盲文是 ${dots}${count}`
  if (item.type === 'final') return `韵母，界面文字是 ${label}，盲文是 ${dots}${count}`
  if (item.type === 'syllable') return `音节 ${label}，${item.toneName || '轻声不标调'}，盲文是 ${dots}${count}`
  if (item.type === 'letter') return `英文字母 ${label}，盲文是 ${dots}`
  if (item.type === 'digit') return `数字 ${label}，数字符号和数字方是 ${dots}`
  return `符号 ${label}，盲文是 ${dots}${count}`
}
