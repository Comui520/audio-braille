// src/input-display.js —— 三个功能共用的六点输入可视化模型
export function buildInputDisplayModel(confirmedCells = [], currentDots = [], cursorIndex = confirmedCells.length) {
  const toFlags = dots => [1, 2, 3, 4, 5, 6].map(dot => dots.includes(dot))
  const cells = Array.isArray(confirmedCells) ? confirmedCells.filter(Array.isArray) : []
  const current = { kind: 'current', cursor: true, dots: toFlags(Array.isArray(currentDots) ? currentDots : []) }
  const output = []
  cells.forEach((cell, index) => {
    if (index === cursorIndex) output.push(current)
    output.push({ kind: 'confirmed', cursor: false, dots: toFlags(cell) })
  })
  if (cursorIndex >= cells.length) output.push(current)
  return output
}
