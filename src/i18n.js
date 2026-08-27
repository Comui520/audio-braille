// src/i18n.js —— 中英双语文案（TTS 提示语 + 屏幕文案）

const LANG_KEY = 'AudioBraille.lang'

// 用内存存储代理 window.localStorage（Node 测试环境无 localStorage）
const memStore = new Map()
const storageLike = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k)
}

// 优先真实 localStorage（含测试注入的 globalThis.localStorage）；否则用内存代理
function store() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage
  return storageLike
}

export function setLangForTest(lang) {
  store().setItem(LANG_KEY, lang)
}

// 中英文案字典（键必须一一对应，测试断言）
const MESSAGES = {
  zh: {
    appName: 'AudioBraille 盲文学习平台',
    welcome: '欢迎来到 AudioBraille 盲文学习平台',
    audioReady: '音频引擎已就绪',
    press0: '请按 0 确认',
    press0Start: '请按 0 确认开始',
    press0Check: '按 0 核对',
    press0Submit: '按 0 提交',
    navTeaching: '教学',
    navInput: '盲文输入器',
    navExperiment: '听觉实验',
    navNotes: '笔记记录器',
    help: '按 0 确认送字。按 3 退格。按减号清空。按加号朗读。按句号空格。F1 帮助。Ctrl 加 Shift 加 M 静音。',
    silentOn: '静音模式开启',
    silentOff: '静音模式关闭',
    langChanged: '语言已切换为',
    empty: '请选择模块',
    clearDone: '已清空',
    noDots: '当前无点位',
    invalidDots: '请输入有效的盲文点位',
    unparsable: '无法解析的音节',
    correct: '正确',
    wrong: '错误',
    lessonTitle: '盲文教学',
    learnBtn: '学',
    practiceBtn: '练',
    examBtn: '考',
    // 教学
    learnIntro: '请听名称与音频，记住点位。按 0 进入下一个。',
    learnAgain: '请再次听音频，按 0 进入下一个',
    practiceIntro: '听名称或音频，打出正确点位。按 0 提交。',
    examIntro: '考核开始。听音频打点位，共 10 题。',
    examOver: (v) => `考核结束，答对 ${v.accuracy} 题，正确率 ${Math.round(v.accuracy * 10)}%`,
    // 实验
    expTitle: 'AudioBraille 听觉实验',
    expStart: '开始实验',
    expIntro: '实验开始。共 10 题。每题先按 0 播放音频，再用数字键输入盲文点位，按 0 提交。',
    expListen: (v) => `第 ${v.label}/${v.total} 题：按 0 播放音频`,
    expAnswer: '请用数字键输入听到的点位，按 0 提交',
    expWrong: (v) => `错误，正确答案是字母 ${v.letter}`,
    expDone: (v) => `实验完成。正确率 ${v.accuracy}%，平均耗时 ${v.time} 秒。`,
    expConfirm: '请按 0 确认开始',
    expModeLetters: '字母辨识',
    expModeSyllables: '拼音音节辨识',
    expModeSymbols: '符号辨识',
    expModeDigits: '数字辨识',
    expShowcase: '先听每个点的声音：左耳为左列点1/2/3（正弦波），右耳为右列点4/5/6（方波）。听完按 0 开始测试。',
    expAStart: 'A 组开始。请听语音朗读的字母，用盲文点位打出。',
    expBStart: 'B 组开始。请听 AudioBraille 空间音频识别字母，用盲文点位作答。',
    expTrialA: (i) => `A 组第 ${i} 题，请打出字母`,
    expTrialB: (i) => `B 组第 ${i} 题，请听音频`,
    expDone: (v) => `实验完成。语音组正确率 ${v.accuracy}%，AudioBraille 组正确率 ${v.accuracy2}%。语音组平均 ${v.time} 秒，AudioBraille 组平均 ${v.time2} 秒。`,
    // 笔记
    notesTitle: '笔记记录器',
    notesSave: '保存',
    notesPlay: '回放',
    notesSaved: '笔记已保存',
    notesNoHistory: '没有历史笔记',
    notesOpened: '已打开',
    notesEmpty: '无明文',
    plainLabel: '明文对照',
    // 盲文输入
    dotsLabel: '当前点位',
    dotsEmpty: '空',
    // 设置
    settingsTitle: '设置',
    langLabel: '语言',
    // 探索/学习
    learnItem: (v) => `请学习字母 ${v.label}：按 ${v.hint} 键`,
    practiceItem: (v) => `请打出字母 ${v.label}，按 0 提交`,
    q: (v) => `请打出字母 ${v.label}`,
    wrongAnswer: (v) => `错误，正确答案是 ${v.expected}`,
    rightAnswer: '正确',
    resultTitle: '实验结果',
    reviewItem: (v) => `复习：请打出 ${v.label}`,
  },
  en: {
    appName: 'AudioBraille Braille Learning Platform',
    welcome: 'Welcome to AudioBraille Braille Learning Platform',
    audioReady: 'Audio engine ready',
    press0: 'Press 0 to confirm',
    press0Start: 'Press 0 to start',
    press0Check: 'Press 0 to check',
    press0Submit: 'Press 0 to submit',
    navTeaching: 'Teaching',
    navInput: 'Braille Input',
    navExperiment: 'Audio Experiment',
    navNotes: 'Notes',
    help: 'Press 0 to confirm. Press 3 to backspace. Press minus to clear. Press plus to read. Press period for space. F1 for help. Ctrl Shift M to mute.',
    silentOn: 'Silent mode on',
    silentOff: 'Silent mode off',
    langChanged: 'Language switched to',
    empty: 'Please select a module',
    clearDone: 'Cleared',
    noDots: 'No dots',
    invalidDots: 'Please enter valid braille dots',
    unparsable: 'Cannot parse syllable',
    correct: 'Correct',
    wrong: 'Wrong',
    lessonTitle: 'Braille Teaching',
    learnBtn: 'Learn',
    practiceBtn: 'Practice',
    examBtn: 'Exam',
    learnIntro: 'Listen to the name and audio, remember the dots. Press 0 for next.',
    learnAgain: 'Listen to the audio again, press 0 for next',
    practiceIntro: 'Listen to the name or audio, type the correct dots. Press 0 to submit.',
    examIntro: 'Exam starts. Listen to audio and type dots. 10 questions.',
    examOver: (v) => `Exam finished, ${v.accuracy} correct, ${Math.round(v.accuracy * 10)}% accuracy`,
    expTitle: 'AudioBraille Audio Experiment',
    expStart: 'Start Experiment',
    expIntro: 'Experiment starts. 10 trials. For each, press 0 to play the audio, then type the braille dots, press 0 to submit.',
    expListen: (v) => `Trial ${v.label}/${v.total}: press 0 to play audio`,
    expAnswer: 'Type the dots you heard, press 0 to submit',
    expWrong: (v) => `Wrong, the answer is letter ${v.letter}`,
    expDone: (v) => `Experiment done. Accuracy ${v.accuracy}%, average time ${v.time}s.`,
    expConfirm: 'Press 0 to confirm start',
    expModeLetters: 'Letters',
    expModeSyllables: 'Syllables',
    expModeSymbols: 'Symbols',
    expModeDigits: 'Digits',
    expShowcase: 'First listen to each dot: left ear for left-column dots 1/2/3 (sine), right ear for right-column dots 4/5/6 (square). Press 0 to start.',
    expAStart: 'Group A starts. Listen to the spoken letter, type it in braille dots.',
    expBStart: 'Group B starts. Listen to AudioBraille spatial audio to identify the letter, answer with braille dots.',
    expTrialA: (i) => `Group A trial ${i}, type the letter`,
    expTrialB: (i) => `Group B trial ${i}, listen to the audio`,
    expDone: (v) => `Experiment done. Voice accuracy ${v.accuracy}%, AudioBraille accuracy ${v.accuracy2}%. Voice avg ${v.time}s, AudioBraille avg ${v.time2}s.`,
    notesTitle: 'Notes',
    notesSave: 'Save',
    notesPlay: 'Playback',
    notesSaved: 'Note saved',
    notesNoHistory: 'No history notes',
    notesOpened: 'Opened',
    notesEmpty: 'No plain text',
    plainLabel: 'Plain text reference',
    dotsLabel: 'Current dots',
    dotsEmpty: 'Empty',
    settingsTitle: 'Settings',
    langLabel: 'Language',
    learnItem: (v) => `Learn letter ${v.label}: press key ${v.hint}`,
    practiceItem: (v) => `Type the letter ${v.label}, press 0 to submit`,
    q: (v) => `Type the letter ${v.label}`,
    wrongAnswer: (v) => `Wrong, the answer is ${v.expected}`,
    rightAnswer: 'Correct',
    resultTitle: 'Experiment Result',
    reviewItem: (v) => `Review: type ${v.label}`
  }
}

export function getLang() {
  return store().getItem(LANG_KEY) || 'zh'
}

export function setLang(lang) {
  if (!MESSAGES[lang]) return false
  store().setItem(LANG_KEY, lang)
  return true
}

// 取当前语言（或指定语言）的文案；函数型支持任意 vars 对象
// 约定：函数接收完整 vars（{label, accuracy, time, ...}），避免参数位错
const _noop = (v) => v

function fmt(tpl, vars) {
  if (typeof tpl === 'function') return tpl(vars)
  if (tpl == null) return null
  let out = tpl
  for (const [k, v] of Object.entries(vars || {})) out = out.replaceAll(`{${k}}`, v)
  return out
}

export function t(key, vars = {}, lang) {
  const dict = MESSAGES[lang || getLang()] || MESSAGES.zh
  const msg = dict[key]
  if (msg == null) return key
  return fmt(msg, vars)
}

export function translateSpeech(lang) {
  return MESSAGES[lang]
}
