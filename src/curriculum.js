// src/curriculum.js —— v9：纯课程数据与进度服务
import { LATIN_LETTERS, INITIALS as INITIAL_TABLE, FINALS } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'

const PINYIN_SYLLABLES = [
  'ba1', 'ba2', 'ba3', 'ba4', 'ba', 'bo1', 'bo2', 'bo3', 'bo4', 'bo',
  'bi1', 'bi2', 'bi3', 'bi4', 'bi', 'bu1', 'bu2', 'bu3', 'bu4', 'bu',
  'ma1', 'ma2', 'ma3', 'ma4', 'ma', 'mo1', 'mo2', 'mo3', 'mo4', 'mo',
  'mi1', 'mi2', 'mi3', 'mi4', 'mi', 'mu1', 'mu2', 'mu3', 'mu4', 'mu',
  'da1', 'da2', 'da3', 'da4', 'da', 'de1', 'de2', 'de3', 'de4', 'de',
  'di1', 'di2', 'di3', 'di4', 'di', 'du1', 'du2', 'du3', 'du4', 'du',
  'la1', 'la2', 'la3', 'la4', 'la', 'li1', 'li2', 'li3', 'li4', 'li',
  'le1', 'le2', 'le3', 'le4', 'le', 'lu1', 'lu2', 'lu3', 'lu4', 'lu',
  'ha1', 'ha2', 'ha3', 'ha4', 'ha', 'he1', 'he2', 'he3', 'he4', 'he',
  'hi1', 'hi2', 'hi3', 'hi4', 'hi', 'hu1', 'hu2', 'hu3', 'hu4', 'hu'
]

const INITIALS = Object.keys(INITIAL_TABLE).filter(item => !['j', 'q', 'x'].includes(item))

export const CURRICULUM = {
  pinyin: {
    id: 'pinyin', label_zh: '中文拼音', label_en: 'Chinese Pinyin', icon: '拼',
    sections: [
      { id: 'initials', label_zh: '声母', label_en: 'Initials', type: 'initial', items: INITIALS },
      { id: 'finals', label_zh: '韵母', label_en: 'Finals', type: 'final', items: Object.keys(FINALS) },
      { id: 'syllables', label_zh: '音节练习', label_en: 'Syllables', type: 'syllable', items: PINYIN_SYLLABLES }
    ]
  },
  latin: {
    id: 'latin', label_zh: '英文字母', label_en: 'English Letters', icon: 'A',
    sections: [
      { id: 'l1', label_zh: 'a-h', label_en: 'a-h', type: 'letter', items: Object.keys(LATIN_LETTERS).slice(0, 8) },
      { id: 'l2', label_zh: 'i-p', label_en: 'i-p', type: 'letter', items: Object.keys(LATIN_LETTERS).slice(8, 16) },
      { id: 'l3', label_zh: 'q-z', label_en: 'q-z', type: 'letter', items: Object.keys(LATIN_LETTERS).slice(16, 26) }
    ]
  },
  symbols: {
    id: 'symbols', label_zh: '符号', label_en: 'Symbols', icon: '符',
    sections: [
      { id: 'cn', label_zh: '中文标点', label_en: 'Chinese Punctuation', type: 'symbol', items: Object.keys(SYMBOLS_CN) },
      { id: 'en', label_zh: '英文标点', label_en: 'English Punctuation', type: 'symbol', items: Object.keys(SYMBOLS_EN) }
    ]
  },
  digits: {
    id: 'digits', label_zh: '数字', label_en: 'Digits', icon: '#',
    sections: [{ id: 'd1', label_zh: '0-9', label_en: '0-9', type: 'digit', items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] }]
  }
}

export function getCategory(categoryId) {
  return CURRICULUM[categoryId] || null
}

export function getSection(categoryId, sectionId) {
  return getCategory(categoryId)?.sections.find(section => section.id === sectionId) || null
}

export function getProgressKey(categoryId, sectionId) {
  return `${categoryId}.${sectionId}`
}

function emptyProgress() {
  return { version: 2, sections: {} }
}

function normalizeProgress(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    version: 2,
    sections: source.version === 2 && source.sections && typeof source.sections === 'object'
      ? source.sections
      : {}
  }
}

function normalizeSection(raw) {
  return {
    learned: Array.isArray(raw?.learned) ? [...new Set(raw.learned)] : [],
    current: raw?.current ?? null
  }
}

export function createProgressStore(storage) {
  if (!storage || typeof storage.loadProgress !== 'function' || typeof storage.saveProgress !== 'function') {
    throw new TypeError('createProgressStore requires storage.loadProgress/saveProgress')
  }

  async function read() {
    return normalizeProgress(await storage.loadProgress())
  }

  async function write(progress) {
    return storage.saveProgress(progress)
  }

  return {
    async getSection(categoryId, sectionId) {
      const progress = await read()
      return normalizeSection(progress.sections[getProgressKey(categoryId, sectionId)])
    },

    async markLearned(categoryId, sectionId, item) {
      const section = getSectionData(categoryId, sectionId)
      if (!section || !section.items.includes(item)) return this.getSection(categoryId, sectionId)
      const progress = await read()
      const key = getProgressKey(categoryId, sectionId)
      const saved = normalizeSection(progress.sections[key])
      if (!saved.learned.includes(item)) saved.learned.push(item)
      saved.current = section.items.find(candidate => !saved.learned.includes(candidate)) || null
      progress.sections[key] = saved
      await write(progress)
      return saved
    },

    async setCurrent(categoryId, sectionId, item) {
      const section = getSectionData(categoryId, sectionId)
      if (!section || (item !== null && !section.items.includes(item))) return this.getSection(categoryId, sectionId)
      const progress = await read()
      const key = getProgressKey(categoryId, sectionId)
      const saved = normalizeSection(progress.sections[key])
      saved.current = item
      progress.sections[key] = saved
      await write(progress)
      return saved
    },

    async getNext(categoryId, sectionId) {
      const section = getSectionData(categoryId, sectionId)
      if (!section) return null
      const saved = await this.getSection(categoryId, sectionId)
      return saved.current || section.items.find(item => !saved.learned.includes(item)) || null
    },

    async getCategory(categoryId) {
      const category = getCategoryData(categoryId)
      if (!category) return { learned: 0, total: 0 }
      const sections = await Promise.all(category.sections.map(section => this.getSection(categoryId, section.id)))
      return {
        learned: sections.reduce((count, section) => count + section.learned.length, 0),
        total: category.sections.reduce((count, section) => count + section.items.length, 0)
      }
    },

    async reset() {
      await write(emptyProgress())
    }
  }
}

function getCategoryData(categoryId) {
  return CURRICULUM[categoryId] || null
}

function getSectionData(categoryId, sectionId) {
  return getCategoryData(categoryId)?.sections.find(section => section.id === sectionId) || null
}
