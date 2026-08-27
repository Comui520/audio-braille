// src/curriculum.js —— v8：课程体系 + 进度管理
import { LATIN_LETTERS, INITIALS, FINALS } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'

// ===== 课程定义 =====
// 音节练习：100 个常用音节（声母 × 韵母 × 声调，选取高频组合）
const COMMON_SYLLABLES = [
  'bā', 'bá', 'bǎ', 'bà', 'ba',
  'mā', 'má', 'mǎ', 'mà', 'ma',
  'dā', 'dá', 'dǎ', 'dà', 'da',
  'tā', 'tá', 'tǎ', 'tà', 'ta',
  'nā', 'ná', 'nǎ', 'nà', 'na',
  'lā', 'lá', 'lǎ', 'là', 'la',
  'gē', 'gé', 'gě', 'gè', 'ge',
  'kē', 'ké', 'kě', 'kè', 'ke',
  'hē', 'hé', 'hě', 'hè', 'he',
  'jī', 'jí', 'jǐ', 'jì', 'ji',
  'qī', 'qí', 'qǐ', 'qì', 'qi',
  'xī', 'xí', 'xǐ', 'xì', 'xi',
  'zhī', 'zhí', 'zhǐ', 'zhì', 'zhi',
  'chī', 'chí', 'chǐ', 'chì', 'chi',
  'shī', 'shí', 'shǐ', 'shì', 'shi',
  'rì', 'ri',
  'zī', 'zí', 'zǐ', 'zì', 'zi',
  'cī', 'cí', 'cǐ', 'cì', 'ci',
  'sī', 'sí', 'sǐ', 'sì', 'si',
  'yī', 'yí', 'yǐ', 'yì', 'yi',
  'wū', 'wú', 'wǔ', 'wù', 'wu'
]

export const CURRICULUM = {
  pinyin: {
    id: 'pinyin',
    label_zh: '中文拼音',
    label_en: 'Chinese Pinyin',
    icon: '🇨🇳',
    sections: [
      {
        id: 'initials',
        label_zh: '单声母',
        label_en: 'Initials',
        items: Object.keys(INITIALS).filter(k => !['j', 'q', 'x'].includes(k)) // 21个（j/q/x 与 g/k/h 同点位）
      },
      {
        id: 'finals',
        label_zh: '单韵母',
        label_en: 'Finals',
        items: ['a', 'o', 'e', 'i', 'u', 'ü']
      },
      {
        id: 'syllables',
        label_zh: '音节练习',
        label_en: 'Syllables',
        items: COMMON_SYLLABLES.slice(0, 100)
      }
    ]
  },
  latin: {
    id: 'latin',
    label_zh: '英文字母',
    label_en: 'English Letters',
    icon: '🔤',
    sections: [
      { id: 'l1', label_zh: 'a-h', label_en: 'a-h', items: Object.keys(LATIN_LETTERS).slice(0, 8) },
      { id: 'l2', label_zh: 'i-p', label_en: 'i-p', items: Object.keys(LATIN_LETTERS).slice(8, 16) },
      { id: 'l3', label_zh: 'q-z', label_en: 'q-z', items: Object.keys(LATIN_LETTERS).slice(16, 26) }
    ]
  },
  symbols: {
    id: 'symbols',
    label_zh: '符号',
    label_en: 'Symbols',
    icon: '🔣',
    sections: [
      { id: 'cn', label_zh: '中文标点', label_en: 'Chinese Punctuation', items: Object.keys(SYMBOLS_CN) },
      { id: 'en', label_zh: '英文标点', label_en: 'English Punctuation', items: Object.keys(SYMBOLS_EN) }
    ]
  },
  digits: {
    id: 'digits',
    label_zh: '数字',
    label_en: 'Digits',
    icon: '🔢',
    sections: [
      { id: 'd1', label_zh: '0-9', label_en: '0-9', items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] }
    ]
  }
}

// ===== 进度管理 =====
const PROGRESS_KEY = 'audiobraille-learning-progress-v2'

// 获取全部进度
export function getProgress() {
  const raw = localStorage.getItem(PROGRESS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// 保存进度
function saveProgress(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
}

// 获取某小节进度
export function getSectionProgress(categoryId, sectionId) {
  const key = `${categoryId}.${sectionId}`
  const all = getProgress()
  return all[key] || { learned: [], current: null }
}

// 标记某项已学
export function markLearned(categoryId, sectionId, item) {
  const key = `${categoryId}.${sectionId}`
  const all = getProgress()
  const sec = all[key] || { learned: [], current: null }
  if (!sec.learned.includes(item)) {
    sec.learned.push(item)
  }
  // 自动设置 current 为下一个未学项
  const category = CURRICULUM[categoryId]
  const section = category.sections.find(s => s.id === sectionId)
  const nextUnlearned = section.items.find(it => !sec.learned.includes(it))
  sec.current = nextUnlearned || null
  all[key] = sec
  saveProgress(all)
}

// 获取下一个未学项
export function getNextItem(categoryId, sectionId) {
  const sec = getSectionProgress(categoryId, sectionId)
  if (sec.current) return sec.current
  const category = CURRICULUM[categoryId]
  const section = category.sections.find(s => s.id === sectionId)
  return section.items.find(it => !sec.learned.includes(it)) || null
}

// 设置当前学习项（手动跳转）
export function setCurrentItem(categoryId, sectionId, item) {
  const key = `${categoryId}.${sectionId}`
  const all = getProgress()
  const sec = all[key] || { learned: [], current: null }
  sec.current = item
  all[key] = sec
  saveProgress(all)
}

// 计算某分类的总进度
export function getCategoryProgress(categoryId) {
  const category = CURRICULUM[categoryId]
  let total = 0
  let learned = 0
  for (const section of category.sections) {
    total += section.items.length
    const sec = getSectionProgress(categoryId, section.id)
    learned += sec.learned.length
  }
  return { learned, total }
}

// 重置进度
export function resetProgress() {
  localStorage.removeItem(PROGRESS_KEY)
}
