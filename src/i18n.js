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
    navHome: '首页',
    navInput: '盲文输入器',
    navExperiment: '听觉实验',
    navNotes: '笔记记录器',
    navReader: '听书',
    homeTitle: 'AudioBraille 盲文学习平台',
    homeSub: '为明眼人设计、盲人友好的盲文教学、输入与听音平台',
    readerTitle: '听书（AudioBraille 朗读）',
    readerSub: '用可调倍速的 AudioBraille 编码朗读示例短文',
    readerSpeed: '速度',
    readerPlay: '播放',
    readerStop: '停止',
    readerPlaying: '正在朗读…',
    readerUnderstand: '你能听懂吗？',
    readerYes: '能听懂',
    readerNo: '听不懂',
    readerThank: '感谢反馈！',
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
    kindPinyin: '中文拼音',
    kindLatin: '英文字母',
    kindSymbols: '符号',
    kindDigits: '数字',
    learnBtn: '学',
    practiceBtn: '练',
    examBtn: '考',
    // 教学
    learnIntro: '请听名称与音频，记住点位。按 0 进入下一个。',
    learnAgain: '请再次听音频，按 0 进入下一个',
    practiceIntro: '听名称或音频，打出正确点位。按 0 提交。',
    examIntro: '考核开始。听音频打点位，共 10 题。',
    examOver: (v) => `考核结束，答对 ${v.accuracy} 题，正确率 ${Math.round(v.accuracy * 10)}%`,
    sectionDone: (v) => `${v.label} 小节学完！按 0 或点击重新开始`,
    // 使用说明（v6 新增）
    navGuide: '使用说明',
    guideTitle: '使用说明',
    guideIntro: '本平台用数字小键盘模拟盲文六点输入。盲文一个“方”有六个点位，左列从上到下是点 1、2、3，右列从上到下是点 4、5、6。',
    guideLayoutTitle: '键位对应',
    guideKeymapCaption: '方格中大数字是盲文点位，小标签是小键盘按键',
    guideControlTitle: '功能键',
    guideKeyCol: '按键',
    guideActionCol: '作用',
    guideKey0: '提交 / 确认 / 上屏',
    guideKeyStar: '下一方（拼音：声母→韵母→声调）',
    guideKeySlash: '上一方（回退阶段）',
    guideKey3: '退格 / 清当前点位',
    guideKeyMinus: '全部清空',
    guideKeyPlus: '朗读当前点位 / 重听音频',
    guideKeyDot: '空格',
    guideKeyF1: '快捷键帮助',
    guideFlowTitle: '使用流程',
    guideFlow: '输入时先按点位键点亮需要的点，右侧会实时显示对应字符，确认后按 0 上屏。',
    guideStep1: '打开页面后按 0 解锁音频与语音（浏览器要求用户主动按键）',
    guideStep2: '按点位键（7/4/1/8/5/2）点亮需要的点，可任意顺序',
    guideStep3: '右侧反馈条实时显示当前组合对应的字符（非法组合不显示）',
    guideStep4: '按 0 提交；拼音需要多方时用 * 进入下一方，/ 回上一方',
    guideModulesTitle: '功能模块',
    guideModTeaching: '分小节学盲文（中文拼音/英文字母/符号/数字），每个小节都有学、练、考三阶段',
    guideModInput: '自由输入体验，试试数字小键盘打盲文',
    guideModExperiment: 'AudioBraille 听觉测试：先听展示（左右声道对应关系），再测能不能听出盲文',
    guideModNotes: '用盲文记笔记，带明文/拼音对照，可导出导入',
    guideModReader: '可调倍速的 AudioBraille 朗读，测能不能听懂',
    guideSpeakBtn: '朗读完整说明',
    guideQuickTitle: '新手引导：',
    guideQuick: '小键盘 7/4/1 是左列点 1/2/3，8/5/2 是右列点 4/5/6；按 0 提交。',
    guideMore: '完整说明',
    // 逐方输入反馈（v7）
    cellConfirmed: (v) => `已确认 ${v.n} 方：${v.braille}，继续输入下一方`,
    cellNext: (v) => `第 ${v.n} 方`,
    cellBack: (v) => `回退到第 ${v.n} 方`,
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
    expDoneDual: (v) => `实验完成。语音组正确率 ${v.accuracy}%，AudioBraille 组正确率 ${v.accuracy2}%。语音组平均 ${v.time} 秒，AudioBraille 组平均 ${v.time2} 秒。`,
    // 笔记
    notesTitle: '笔记记录器',
    notesSave: '保存',
    notesPlay: '回放',
    notesPlayStart: '开始回放盲文音频',
    notesExport: '导出',
    notesImport: '导入',
    notesNew: '新建',
    notesExported: '已导出',
    notesImported: '已导入',
    notesSaved: '笔记已保存',
    notesNoHistory: '没有历史笔记',
    notesOpened: '已打开',
    notesEmpty: '无明文',
    plainLabel: '明文对照',
    pinyinLabel: '拼音',
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
    navHome: 'Home',
    navInput: 'Braille Input',
    navExperiment: 'Audio Test',
    navNotes: 'Notes',
    navReader: 'Reader',
    homeTitle: 'AudioBraille Braille Learning Platform',
    homeSub: 'A braille teaching, input and audio platform designed for sighted users, friendly for the blind',
    readerTitle: 'Reader (AudioBraille)',
    readerSub: 'Listen to the sample text read in AudioBraille encoding at adjustable speed',
    readerSpeed: 'Speed',
    readerPlay: 'Play',
    readerStop: 'Stop',
    readerPlaying: 'Reading…',
    readerUnderstand: 'Can you understand?',
    readerYes: 'Yes',
    readerNo: 'No',
    readerThank: 'Thanks for the feedback!',
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
    kindPinyin: 'Pinyin',
    kindLatin: 'Letters',
    kindSymbols: 'Symbols',
    kindDigits: 'Numbers',
    learnBtn: 'Learn',
    practiceBtn: 'Practice',
    examBtn: 'Exam',
    learnIntro: 'Listen to the name and audio, remember the dots. Press 0 for next.',
    learnAgain: 'Listen to the audio again, press 0 for next',
    practiceIntro: 'Listen to the name or audio, type the correct dots. Press 0 to submit.',
    examIntro: 'Exam starts. Listen to audio and type dots. 10 questions.',
    examOver: (v) => `Exam finished, ${v.accuracy} correct, ${Math.round(v.accuracy * 10)}% accuracy`,
    sectionDone: (v) => `Section ${v.label} done! Press 0 or click to restart`,
    // Guide (v6)
    navGuide: 'Guide',
    guideTitle: 'How to Use',
    guideIntro: 'This platform uses the numeric keypad to simulate six-dot braille input. A braille "cell" has six dots: left column top-to-bottom is dots 1, 2, 3; right column top-to-bottom is dots 4, 5, 6.',
    guideLayoutTitle: 'Key Mapping',
    guideKeymapCaption: 'Big numbers are braille dots, small labels are keypad keys',
    guideControlTitle: 'Control Keys',
    guideKeyCol: 'Key',
    guideActionCol: 'Action',
    guideKey0: 'Submit / confirm / commit',
    guideKeyStar: 'Next cell (pinyin: initial → final → tone)',
    guideKeySlash: 'Previous cell (go back)',
    guideKey3: 'Backspace / clear current dots',
    guideKeyMinus: 'Clear all',
    guideKeyPlus: 'Read current dots / replay audio',
    guideKeyDot: 'Space',
    guideKeyF1: 'Shortcut help',
    guideFlowTitle: 'Workflow',
    guideFlow: 'Press dot keys to light up the dots you need; the right side shows the matching character in real time; press 0 to commit.',
    guideStep1: 'After opening the page press 0 to unlock audio and speech (browsers require a user keypress)',
    guideStep2: 'Press dot keys (7/4/1/8/5/2) to light the dots you need, in any order',
    guideStep3: 'The feedback bar shows the character for the current combination (invalid combos show nothing)',
    guideStep4: 'Press 0 to submit; for multi-cell pinyin use * for the next cell and / to go back',
    guideModulesTitle: 'Modules',
    guideModTeaching: 'Learn braille by section (pinyin / letters / symbols / numbers), each with Learn, Practice and Exam',
    guideModInput: 'Free input practice — try typing braille with the numeric keypad',
    guideModExperiment: 'AudioBraille listening test: hear the showcase (left/right channel mapping) first, then test whether you can hear braille',
    guideModNotes: 'Take braille notes with plain-text / pinyin reference, export and import supported',
    guideModReader: 'AudioBraille reading at adjustable speed — test whether you can understand it',
    guideSpeakBtn: 'Read the full guide',
    guideQuickTitle: 'Quick start:',
    guideQuick: 'Keypad 7/4/1 are left-column dots 1/2/3, 8/5/2 are right-column dots 4/5/6; press 0 to submit.',
    guideMore: 'Full guide',
    // Multi-cell input feedback (v7)
    cellConfirmed: (v) => `Cell ${v.n} confirmed: ${v.braille}, type the next cell`,
    cellNext: (v) => `Cell ${v.n}`,
    cellBack: (v) => `Back to cell ${v.n}`,
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
    expDoneDual: (v) => `Experiment done. Voice accuracy ${v.accuracy}%, AudioBraille accuracy ${v.accuracy2}%. Voice avg ${v.time}s, AudioBraille avg ${v.time2}s.`,
    notesTitle: 'Notes',
    notesSave: 'Save',
    notesPlay: 'Playback',
    notesPlayStart: 'Playing braille audio',
    notesExport: 'Export',
    notesImport: 'Import',
    notesNew: 'New',
    notesExported: 'Exported',
    notesImported: 'Imported',
    notesSaved: 'Note saved',
    notesNoHistory: 'No history notes',
    notesOpened: 'Opened',
    notesEmpty: 'No plain text',
    plainLabel: 'Plain text reference',
    pinyinLabel: 'Pinyin',
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
