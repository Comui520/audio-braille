// src/input-display.js —— 当前多方输入的六点可视化模型
export function buildInputDisplayModel(confirmedCells = [], currentDots = [], cursorIndex = confirmedCells.length) {
  const toFlags = dots => [1, 2, 3, 4, 5, 6].map(dot => Array.isArray(dots) && dots.includes(dot))
  const cells = Array.isArray(confirmedCells) ? confirmedCells : []
  const current = { kind: 'current', cursor: true, dots: toFlags(Array.isArray(currentDots) ? currentDots : []) }
  const output = []
  cells.forEach((atom, index) => {
    if (index === cursorIndex) output.push(current)
    if (Array.isArray(atom)) {
      output.push({ kind: 'confirmed', cursor: false, dots: toFlags(atom) })
    } else if (atom === null) {
      output.push({ kind: 'space', cursor: false, dots: toFlags([]), text: ' ' })
    } else if (atom && atom.kind === 'text') {
      output.push({ kind: 'text', cursor: false, dots: toFlags([]), text: atom.value || '' })
    }
  })
  if (cursorIndex >= cells.length) output.push(current)
  return output
}
