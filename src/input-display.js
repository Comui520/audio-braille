// src/input-display.js —— 三个功能共用的六点输入可视化模型
export function buildDocumentDisplayModel(documentCells = [], documentCursor = 0, showCursor = true) {
  const cells = Array.isArray(documentCells) ? documentCells : []
  const output = []
  const cursor = { kind: 'document-cursor', cursor: true }
  cells.forEach((unit, index) => {
    if (showCursor && index === documentCursor) output.push(cursor)
    if (unit === null) {
      output.push({ kind: 'space', cursor: false, text: ' ' })
    } else if (Array.isArray(unit)) {
      output.push({ kind: 'document', cursor: false, cells: unit.map(dots => [1, 2, 3, 4, 5, 6].map(dot => Array.isArray(dots) && dots.includes(dot))) })
    }
  })
  if (showCursor && documentCursor >= cells.length) output.push(cursor)
  return output
}
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
