// src/guide.js —— 使用说明（首次进入必读 + 随时可查）
// 用户反馈：第一次进入网站的用户根本不知道使用方法
// 设计：①启动门内嵌简要说明 ②首页顶部快速指引 ③独立"使用说明"页（完整规则）
// 盲人友好：文字 + TTS 朗读；明眼人友好：视觉化点位图
import { t, getLang } from './i18n.js'

// 键位对应表（官方布局）：7=点1, 4=点2, 1=点3, 8=点4, 5=点5, 2=点6
export const KEY_LAYOUT = [
  { key: '7', dot: 1, pos: 'topLeft' },
  { key: '4', dot: 2, pos: 'midLeft' },
  { key: '1', dot: 3, pos: 'botLeft' },
  { key: '8', dot: 4, pos: 'topRight' },
  { key: '5', dot: 5, pos: 'midRight' },
  { key: '2', dot: 6, pos: 'botRight' }
]

// 功能键说明
export const CONTROL_KEYS = [
  { key: '0', actionKey: 'guideKey0' },
  { key: '*', actionKey: 'guideKeyStar' },
  { key: '/', actionKey: 'guideKeySlash' },
  { key: '3', actionKey: 'guideKey3' },
  { key: '-', actionKey: 'guideKeyMinus' },
  { key: '+', actionKey: 'guideKeyPlus' },
  { key: '.', actionKey: 'guideKeyDot' },
  { key: 'F1', actionKey: 'guideKeyF1' }
]

// 生成 TTS 朗读文本（完整说明，供盲人用户听）
export function buildGuideSpeech() {
  const layout = KEY_LAYOUT.map(k => `${k.key} 键是点 ${k.dot}`).join('，')
  const controls = CONTROL_KEYS.map(c => `${c.key} 键${t(c.actionKey)}`).join('，')
  return `${t('guideIntro')} ${t('guideLayoutTitle')}：${layout}。${t('guideControlTitle')}：${controls}。${t('guideFlow')}`
}

// 视觉化点位图（明眼人友好）：3行2列，标注键位
export function renderKeyMapDiagram() {
  return `
    <div class="keymap">
      <div class="keymap-grid">
        <div class="keymap-cell"><span class="keymap-dot">1</span><span class="keymap-key">7</span></div>
        <div class="keymap-cell"><span class="keymap-dot">4</span><span class="keymap-key">8</span></div>
        <div class="keymap-cell"><span class="keymap-dot">2</span><span class="keymap-key">4</span></div>
        <div class="keymap-cell"><span class="keymap-dot">5</span><span class="keymap-key">5</span></div>
        <div class="keymap-cell"><span class="keymap-dot">3</span><span class="keymap-key">1</span></div>
        <div class="keymap-cell"><span class="keymap-dot">6</span><span class="keymap-key">2</span></div>
      </div>
      <p class="keymap-caption">${t('guideKeymapCaption')}</p>
    </div>`
}

// 完整说明页视图
export function guideView() {
  const sec = document.createElement('section')
  sec.className = 'guide'
  const controls = CONTROL_KEYS.map(c =>
    `<tr><td class="guide-key">${c.key}</td><td>${t(c.actionKey)}</td></tr>`
  ).join('')
  sec.innerHTML = `
    <h1>${t('guideTitle')}</h1>
    <p class="guide-intro">${t('guideIntro')}</p>

    <h2>${t('guideLayoutTitle')}</h2>
    ${renderKeyMapDiagram()}

    <h2>${t('guideControlTitle')}</h2>
    <table class="guide-table">
      <thead><tr><th>${t('guideKeyCol')}</th><th>${t('guideActionCol')}</th></tr></thead>
      <tbody>${controls}</tbody>
    </table>

    <h2>${t('guideFlowTitle')}</h2>
    <ol class="guide-steps">
      <li>${t('guideStep1')}</li>
      <li>${t('guideStep2')}</li>
      <li>${t('guideStep3')}</li>
      <li>${t('guideStep4')}</li>
    </ol>

    <h2>${t('guideModulesTitle')}</h2>
    <ul class="guide-modules">
      <li><strong>${t('navTeaching')}</strong>：${t('guideModTeaching')}</li>
      <li><strong>${t('navInput')}</strong>：${t('guideModInput')}</li>
      <li><strong>${t('navExperiment')}</strong>：${t('guideModExperiment')}</li>
      <li><strong>${t('navNotes')}</strong>：${t('guideModNotes')}</li>
      <li><strong>${t('navReader')}</strong>：${t('guideModReader')}</li>
    </ul>

    <button id="guide-speak" class="btn-primary">🔊 ${t('guideSpeakBtn')}</button>
  `
  return sec
}

// 首页快速指引卡（简短版）
export function renderQuickGuide() {
  return `
    <div class="quick-guide">
      <strong>${t('guideQuickTitle')}</strong>
      <span>${t('guideQuick')}</span>
      <button data-nav="guide" class="quick-guide-link">${t('guideMore')} →</button>
    </div>`
}
