// src/input-display.js —— 三个功能共用的六点输入可视化模型
export function buildInputDisplayModel(confirmedCells = [], currentDots = []) {
  const toFlags = dots => [1, 2, 3, 4, 5, 6].map(dot => dots.includes(dot))
  const confirmed = Array.isArray(confirmedCells)
    ? confirmedCells.filter(Array.isArray).map(dots => ({ kind: 'confirmed', dots: toFlags(dots) }))
    : []
  return [...confirmed, { kind: 'current', dots: toFlags(Array.isArray(currentDots) ? currentDots : []) }]
}
