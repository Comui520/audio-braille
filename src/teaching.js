// src/teaching.js —— v9：四大区域与自由选择教学模型
import {
  LATIN_LETTERS,
  latinToDots,
  INITIALS,
  FINALS,
  DIGIT_SIGN,
  DIGIT_LETTERS,
  syllableToDots
} from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN, CN_SYMBOL_NAMES, EN_SYMBOL_NAMES } from './data/symbols.js'
import { cellsToUnicode, gradeCells, keyHintForCells, speakableDigits, toCells } from './cells.js'
import { buildTeachingSpeech } from './teaching-speech.js'
import { CURRICULUM } from './curriculum.js'

export const LESSON_TYPES = ['pinyin', 'latin', 'symbols', 'digits']
export const TONE_NAMES = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

const INITIAL_LIST = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']
const DIGIT_TO_LETTER = Object.fromEntries(Object.entries(DIGIT_LETTERS).map(([letter, digit]) => [digit, letter]))

function categoryLabel(category, lang = 'zh') {
  return lang === 'en' ? category.label_en : category.label_zh
}

export function getTeachingCategories(lang = 'zh') {
  return LESSON_TYPES.map(id => {
    const category = CURRICULUM[id]
    return { id, label: categoryLabel(category, lang), icon: category.icon }
  })
}

export function getTeachingSections(categoryId, lang = 'zh') {
  const category = CURRICULUM[categoryId]
  if (!category) return []
  return category.sections.map(section => ({
    id: section.id,
    label: lang === 'en' ? section.label_en : section.label_zh,
    type: section.type,
    items: [...section.items]
  }))
}

function parseSyllable(value) {
  const match = String(value).match(/^(.*?)([1-4])?$/)
  if (!match) return null
  const body = match[1]
  const tone = match[2] || null
  const initial = INITIAL_LIST.find(candidate => body.startsWith(candidate) && body.length > candidate.length) || ''
  const final = initial ? body.slice(initial.length) : body
  if (!FINALS[final]) return null
  return { initial, final, tone }
}

function itemCells(categoryId, sectionId, itemId) {
  if (categoryId === 'pinyin') {
    if (sectionId === 'initials') return toCells(INITIALS[itemId])
    if (sectionId === 'finals') return toCells(FINALS[itemId])
    const syllable = parseSyllable(itemId)
    return syllable ? toCells(syllableToDots(syllable.initial, syllable.final, syllable.tone)) : []
  }
  if (categoryId === 'latin') return toCells(latinToDots(itemId))
  if (categoryId === 'symbols') {
    const table = sectionId === 'cn' ? SYMBOLS_CN : SYMBOLS_EN
    return toCells(table[itemId])
  }
  if (categoryId === 'digits') return toCells([DIGIT_SIGN, latinToDots(DIGIT_TO_LETTER[itemId])])
  return []
}

function itemType(categoryId, sectionId) {
  if (categoryId === 'pinyin') return sectionId === 'initials' ? 'initial' : sectionId === 'finals' ? 'final' : 'syllable'
  if (categoryId === 'latin') return 'letter'
  if (categoryId === 'symbols') return 'symbol'
  return 'digit'
}

export function getTeachingItem(categoryId, sectionId, itemId, lang = 'zh') {
  const section = CURRICULUM[categoryId]?.sections.find(value => value.id === sectionId)
  if (!section || !section.items.includes(itemId)) return null
  const type = itemType(categoryId, sectionId)
  const cells = itemCells(categoryId, sectionId, itemId)
  const names = sectionId === 'cn' ? CN_SYMBOL_NAMES : EN_SYMBOL_NAMES
  const syllable = type === 'syllable' ? parseSyllable(itemId) : null
  return {
    id: `${categoryId}.${sectionId}.${itemId}`,
    category: categoryId,
    section: sectionId,
    type,
    label: type === 'symbol' ? (names[itemId] || itemId) : itemId,
    symbol: type === 'symbol' ? itemId : null,
    tone: syllable?.tone || null,
    toneName: syllable?.tone ? TONE_NAMES[syllable.tone] : null,
    cells,
    unicode: cellsToUnicode(cells),
    lang
  }
}

export function getTeachingItems(categoryId, sectionId, progress = {}) {
  const section = CURRICULUM[categoryId]?.sections.find(value => value.id === sectionId)
  if (!section) return []
  const learned = new Set(Array.isArray(progress.learned) ? progress.learned : [])
  return section.items.map(itemId => ({
    ...getTeachingItem(categoryId, sectionId, itemId),
    learned: learned.has(itemId),
    current: progress.current === itemId
  }))
}

export function markTeachingLearned(progress = {}, itemId, orderedItems = []) {
  const learned = [...new Set([...(Array.isArray(progress.learned) ? progress.learned : []), itemId])]
  const current = orderedItems.find(item => !learned.includes(item)) || null
  return { learned, current }
}

export function buildItemSpeech(item, lang = 'zh') {
  return buildTeachingSpeech(item, lang)
}

// 兼容旧测试/调用者：返回带 cells 的小节数据，不再返回混合 dots 形态。
export function buildSections(kind, lang = 'zh') {
  return getTeachingSections(kind, lang).map(section => ({
    id: section.id,
    label: section.label,
    items: getTeachingItems(kind, section.id).map(item => ({
      ...item,
      ch: item.symbol || item.label,
      dots: undefined
    }))
  }))
}

// 兼容旧纯逻辑 API
export function gradeAnswer(expected, given) {
  return gradeCells(expected, given)
}
export function gradeAnswerMulti(expected, given) {
  return gradeCells(expected, given)
}
export function keyHintForDots(dots) {
  return keyHintForCells(dots)
}
export function isLearnPhase(phase) { return phase === 'learn' }

export function createReviewer() {
  const map = new Map()
  function entry(key) {
    if (!map.has(key)) map.set(key, { errors: 0, streak: 0 })
    return map.get(key)
  }
  return {
    record(key, correct) {
      const value = entry(key)
      if (correct) {
        value.streak += 1
        if (value.streak >= 3 && value.errors >= 2) map.delete(key)
      } else {
        value.errors += 1
        value.streak = 0
      }
    },
    isInReview(key) {
      const value = map.get(key)
      return Boolean(value && value.errors >= 2 && value.streak < 3)
    },
    reviewQueue() { return [...map.keys()].filter(key => this.isInReview(key)) },
    toJSON() { return Object.fromEntries(map) },
    fromJSON(data) { for (const [key, value] of Object.entries(data || {})) map.set(key, value) }
  }
}

export function pickExamQuestion({ index, reviewQueue }) {
  if (index % 5 === 4 && reviewQueue.length > 0) return reviewQueue[index % reviewQueue.length]
  return null
}

// 课程数据；点位由 getTeachingItem 按现有权威引擎即时生成。

// 旧 UI 初始化接口保留为轻量适配层，新的 app.js 使用纯函数 API。
export function initTeaching() {
  return {
    view: () => document.createElement('section'),
    handleConfirm: () => false
  }
}
