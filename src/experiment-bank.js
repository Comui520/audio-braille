import { LATIN_LETTERS, latinToDots, DIGIT_SIGN } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'
import { PINYIN_SYLLABLES } from './data/pinyin-syllables.js'
import { getTeachingItem } from './teaching.js'
import { toCells } from './cells.js'

export const RECOGNITION_BANK_VERSION = 'recognition-v13-1'
const TONE_OPTIONS = [null, '1', '2', '3', '4']
const DIGIT_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }
const TONE_NAMES = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }

function cloneCells(cells) {
  return cells.map(cell => [...cell])
}

function featureMetadata(cells) {
  const safe = cloneCells(cells)
  const dotCount = safe.reduce((sum, cell) => sum + cell.length, 0)
  const leftColumnCount = dotCountFor(safe, dot => dot <= 3)
  const rightColumnCount = dotCount - leftColumnCount
  const cellCount = safe.length
  const difficultyStratum = cellCount >= 3 || dotCount >= 10
    ? 'high'
    : cellCount === 2 || dotCount >= 5
      ? 'medium'
      : 'low'
  return { cells: safe, cellCount, dotCount, leftColumnCount, rightColumnCount, difficultyStratum }
}

function dotCountFor(cells, predicate) {
  return cells.reduce((sum, cell) => sum + cell.filter(predicate).length, 0)
}

function withMetadata(item) {
  return { ...item, ...featureMetadata(item.cells) }
}

function buildLetterBank() {
  return Object.keys(LATIN_LETTERS).map(letter => withMetadata({
    stimulusId: `letters:${letter}`,
    bankVersion: RECOGNITION_BANK_VERSION,
    mode: 'letters',
    label: letter,
    cells: toCells(latinToDots(letter))
  }))
}

function buildDigitBank() {
  return Object.keys(DIGIT_LETTER).map(digit => withMetadata({
    stimulusId: `digits:${digit}`,
    bankVersion: RECOGNITION_BANK_VERSION,
    mode: 'digits',
    label: digit,
    cells: toCells([DIGIT_SIGN, latinToDots(DIGIT_LETTER[digit])])
  }))
}

function buildSymbolBank(lang = 'zh') {
  const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
  return Object.entries(table).map(([symbol, dots]) => withMetadata({
    stimulusId: `symbols:${encodeURIComponent(symbol)}`,
    bankVersion: RECOGNITION_BANK_VERSION,
    mode: 'symbols',
    label: symbol,
    cells: toCells(dots)
  }))
}

function buildSyllableBank() {
  return PINYIN_SYLLABLES.flatMap(base => TONE_OPTIONS.map(tone => {
    const item = getTeachingItem('pinyin', 'syllables', base, 'zh', tone)
    return withMetadata({
      stimulusId: `syllables:${base}:tone-${tone || 'none'}`,
      bankVersion: RECOGNITION_BANK_VERSION,
      mode: 'syllables',
      label: `${base}${tone ? `（${TONE_NAMES[tone]}）` : ''}`,
      syllable: base,
      tone,
      cells: item?.cells || []
    })
  })).filter(item => item.cells.length > 0)
}

export function buildRecognitionBank(lang = 'zh') {
  return {
    letters: buildLetterBank(),
    syllables: buildSyllableBank(),
    symbols: buildSymbolBank(lang),
    digits: buildDigitBank()
  }
}

function seedNumber(seed) {
  let value = 2166136261
  for (const char of String(seed)) {
    value ^= char.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function seededRandom(seed) {
  let value = seedNumber(seed)
  return () => {
    value = (value + 0x6D2B79F5) | 0
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(items, random) {
  const output = [...items]
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[output[index], output[swap]] = [output[swap], output[index]]
  }
  return output
}

export function sampleRecognitionTrials(bank, count, seed = 'default') {
  if (!Array.isArray(bank) || count <= 0) return []
  const random = seededRandom(seed)
  const buckets = new Map()
  for (const item of bank) {
    const tone = item.mode === 'syllables' ? item.tone || 'none' : 'all'
    const key = `${item.difficultyStratum}:${item.cellCount}:${tone}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }
  const queues = shuffle([...buckets.entries()], random).map(([key, items]) => [key, shuffle(items, random)])
  const selected = []
  let round = 0
  while (selected.length < count && queues.some(([, items]) => items.length > 0)) {
    for (const queue of queues) {
      const items = queue[1]
      if (items.length === 0) continue
      selected.push(items.shift())
      if (selected.length >= count) break
    }
    round += 1
    if (round > count + queues.length) break
  }
  if (selected.length < count) {
    const fallback = shuffle(bank, random)
    while (selected.length < count && fallback.length > selected.length) selected.push(fallback[selected.length])
  }
  return selected.map(item => ({ ...item, cells: cloneCells(item.cells) }))
}
