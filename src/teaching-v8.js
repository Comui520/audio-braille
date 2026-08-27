// src/teaching-v8.js —— v8：三级教学页面（首页/分类/单项）
import { speak } from './speech.js'
import { t, getLang } from './i18n.js'
import { playAudioBraille } from './audio-braille.js'
import { latinToDots, syllableToDots, INITIALS, FINALS } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'
import { toCells, cellsToUnicode, cellsToDiagram, keyHintForCells, gradeCells, speakableDigits } from './cells.js'
import { CURRICULUM, getProgress, getSectionProgress, markLearned, getNextItem, setCurrentItem, getCategoryProgress } from './curriculum.js'

// ===== 教学状态 =====
let currentView = 'home' // home | category | item
let currentCategory = null // pinyin | latin | symbols | digits
let currentSection = null // initials | finals | ...
let currentItem = null // b | a | ...
let currentPhase = 'learn' // learn | practice | exam
let renderFn = null // 渲染函数（由 initTeaching 注入）

// ===== 页面 1：教学首页（四大卡片）=====
function homeView() {
  const lang = getLang()
  const sec = document.createElement('section')
  sec.innerHTML = `
    <h1>${t('navTeaching')}</h1>
    <p>${t('teachingIntro') || '选择学习内容'}</p>
    <div class="teaching-home-grid">
      ${Object.keys(CURRICULUM).map(catId => {
        const cat = CURRICULUM[catId]
        const prog = getCategoryProgress(catId)
        const label = lang === 'en' ? cat.label_en : cat.label_zh
        return `
          <button class="teaching-card" data-category="${catId}">
            <span class="card-icon">${cat.icon}</span>
            <span class="card-label">${label}</span>
            <span class="card-progress">${prog.learned}/${prog.total} ${t('learned') || '已学'}</span>
          </button>
        `
      }).join('')}
    </div>
  `
  sec.querySelectorAll('.teaching-card').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.category
      currentView = 'category'
      if (renderFn) renderFn()
    })
  })
  return sec
}

// ===== 页面 2：分类页（小节列表 + 进度条）=====
function categoryView() {
  const lang = getLang()
  const cat = CURRICULUM[currentCategory]
  const catLabel = lang === 'en' ? cat.label_en : cat.label_zh
  const sec = document.createElement('section')
  
  const sectionsHtml = cat.sections.map(section => {
    const secProg = getSectionProgress(currentCategory, section.id)
    const total = section.items.length
    const learned = secProg.learned.length
    const percent = total > 0 ? Math.round((learned / total) * 100) : 0
    const secLabel = lang === 'en' ? section.label_en : section.label_zh
    const nextItem = getNextItem(currentCategory, section.id)
    
    return `
      <div class="section-block">
        <h3>${secLabel}（${total}个）<span class="progress-text">${learned}/${total}</span></h3>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="item-grid">
          ${section.items.map(item => {
            const isLearned = secProg.learned.includes(item)
            const isCurrent = item === secProg.current
            return `
              <button class="item-btn ${isLearned ? 'learned' : ''} ${isCurrent ? 'current' : ''}"
                data-section="${section.id}" data-item="${item}">
                ${item}${isLearned ? '✓' : ''}
              </button>
            `
          }).join('')}
        </div>
        ${nextItem ? `<button class="continue-btn" data-section="${section.id}" data-item="${nextItem}">继续学习 ${nextItem} →</button>` : ''}
      </div>
    `
  }).join('')
  
  sec.innerHTML = `
    <button class="back-btn">← ${t('back') || '返回'}</button>
    <h1>${catLabel}</h1>
    ${sectionsHtml}
  `
  
  sec.querySelector('.back-btn').addEventListener('click', () => {
    currentView = 'home'
    currentCategory = null
    if (renderFn) renderFn()
  })
  
  sec.querySelectorAll('.item-btn, .continue-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSection = btn.dataset.section
      currentItem = btn.dataset.item
      currentPhase = 'learn'
      currentView = 'item'
      setCurrentItem(currentCategory, currentSection, currentItem)
      if (renderFn) renderFn()
    })
  })
  
  return sec
}

// ===== 页面 3：单项学习页（声母 b / 字母 a / 符号 。）=====
function itemView(state) {
  const lang = getLang()
  const cat = CURRICULUM[currentCategory]
  const section = cat.sections.find(s => s.id === currentSection)
  const items = section.items
  const currentIndex = items.indexOf(currentItem)
  
  // 获取盲文数据
  let cells = []
  let itemType = ''
  if (currentCategory === 'pinyin') {
    if (currentSection === 'initials') {
      cells = toCells(INITIALS[currentItem])
      itemType = 'initial'
    } else if (currentSection === 'finals') {
      cells = toCells(FINALS[currentItem])
      itemType = 'final'
    } else {
      // 音节（需解析声调）
      cells = toCells(syllableToDots(currentItem.replace(/[āáǎà]/g,'a').replace(/[ēéěè]/g,'e').replace(/[īíǐì]/g,'i').replace(/[ōóǒò]/g,'o').replace(/[ūúǔù]/g,'u'))) // 简化：暂不解析声调，后续补
      itemType = 'syllable'
    }
  } else if (currentCategory === 'latin') {
    cells = toCells(latinToDots(currentItem))
    itemType = 'letter'
  } else if (currentCategory === 'symbols') {
    const table = currentSection === 'cn' ? SYMBOLS_CN : SYMBOLS_EN
    cells = toCells(table[currentItem])
    itemType = 'symbol'
  } else if (currentCategory === 'digits') {
    cells = toCells([[3,4,5,6], latinToDots(currentItem)])
    itemType = 'digit'
  }
  
  const hint = keyHintForCells(cells)
  const unicode = cellsToUnicode(cells)
  const diagram = cellsToDiagram(cells)
  
  const sec = document.createElement('section')
  sec.innerHTML = `
    <button class="back-btn">← ${lang === 'en' ? section.label_en : section.label_zh}</button>
    <h1>${getItemTitle(itemType, currentItem)}</h1>
    
    <div class="item-display">
      <div class="braille-large">
        ${diagram.map(d => `
          <span class="bd-cell-large">
            ${d.dots.map((on, i) => `<span class="bd-dot-large ${on ? 'on' : ''}"></span>`).join('')}
          </span>
        `).join('')}
        <span class="bd-unicode-large">${unicode}</span>
      </div>
      <div class="item-info">
        <p><strong>键位：</strong>${hint}（${speakableDigits(hint)}）</p>
        <button class="play-btn">▶ 播放音频</button>
      </div>
    </div>
    
    <div class="phase-selector">
      <button class="phase-btn ${currentPhase === 'learn' ? 'active' : ''}" data-phase="learn">📖 学</button>
      <button class="phase-btn ${currentPhase === 'practice' ? 'active' : ''}" data-phase="practice">✍️ 练</button>
      <button class="phase-btn ${currentPhase === 'exam' ? 'active' : ''}" data-phase="exam">📝 考</button>
    </div>
    
    <div id="phase-content"></div>
    
    <div class="item-nav">
      ${currentIndex > 0 ? `<button class="nav-prev">← 上一个</button>` : '<span></span>'}
      <button class="mark-learned-btn">✓ 学会了</button>
      ${currentIndex < items.length - 1 ? `<button class="nav-next">下一个 →</button>` : '<span></span>'}
    </div>
  `
  
  sec.querySelector('.back-btn').addEventListener('click', () => {
    currentView = 'category'
    currentSection = null
    currentItem = null
    if (renderFn) renderFn()
  })
  
  sec.querySelector('.play-btn').addEventListener('click', () => {
    playCellsSequence(cells)
  })
  
  sec.querySelectorAll('.phase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPhase = btn.dataset.phase
      if (renderFn) renderFn()
    })
  })
  
  sec.querySelector('.mark-learned-btn').addEventListener('click', () => {
    markLearned(currentCategory, currentSection, currentItem)
    speak('已标记为已学')
    // 自动跳转下一个
    if (currentIndex < items.length - 1) {
      currentItem = items[currentIndex + 1]
      setCurrentItem(currentCategory, currentSection, currentItem)
      if (renderFn) renderFn()
    } else {
      speak('本小节全部学完')
    }
  })
  
  const prevBtn = sec.querySelector('.nav-prev')
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentItem = items[currentIndex - 1]
      setCurrentItem(currentCategory, currentSection, currentItem)
      if (renderFn) renderFn()
    })
  }
  
  const nextBtn = sec.querySelector('.nav-next')
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentItem = items[currentIndex + 1]
      setCurrentItem(currentCategory, currentSection, currentItem)
      if (renderFn) renderFn()
    })
  }
  
  // 渲染阶段内容
  renderPhaseContent(sec.querySelector('#phase-content'), itemType, cells, state)
  
  return sec
}

function getItemTitle(type, item) {
  if (type === 'initial') return `声母：${item}`
  if (type === 'final') return `韵母：${item}`
  if (type === 'syllable') return `音节：${item}`
  if (type === 'letter') return `字母：${item}`
  if (type === 'symbol') return `符号：${item}`
  if (type === 'digit') return `数字：${item}`
  return item
}

function renderPhaseContent(container, itemType, cells, state) {
  if (currentPhase === 'learn') {
    container.innerHTML = `<p class="phase-hint">${t('learnPhaseHint') || '观察盲文形态，按播放键听音频，熟悉后点"学会了"进入下一个。'}</p>`
    speakItemDescription(itemType, currentItem, cells)
  } else if (currentPhase === 'practice') {
    container.innerHTML = `
      <p class="phase-hint">${t('practicePhaseHint') || '根据提示输入盲文，按 0 提交。'}</p>
      <div id="braille-dots">${renderDots(state)}</div>
      <div id="input-feedback"></div>
    `
  } else {
    container.innerHTML = `
      <p class="phase-hint">${t('examPhaseHint') || '无提示输入，按 0 提交。'}</p>
      <div id="braille-dots">${renderDots(state)}</div>
      <div id="input-feedback"></div>
    `
  }
}

function speakItemDescription(type, item, cells) {
  const hint = keyHintForCells(cells)
  const speakable = speakableDigits(hint)
  if (type === 'initial') {
    speak(`声母 ${item}，盲文是点 ${speakable}`)
  } else if (type === 'final') {
    speak(`韵母 ${item}，盲文是点 ${speakable}`)
  } else if (type === 'syllable') {
    speak(`音节 ${item}，盲文是点 ${speakable}`)
  } else if (type === 'letter') {
    speak(`字母 ${item}，盲文是点 ${speakable}`)
  } else if (type === 'symbol') {
    speak(`符号 ${item}，盲文是点 ${speakable}`)
  } else if (type === 'digit') {
    speak(`数字 ${item}，盲文是点 ${speakable}`)
  }
}

function renderDots(state) {
  return state.brailleDots.map((on, i) => 
    `<span class="dot ${on ? 'on' : ''}" data-dot="${i}"></span>`
  ).join('')
}

function playCellsSequence(cells) {
  toCells(cells).forEach((cell, i) => {
    setTimeout(() => playAudioBraille(cell, { duration: 0.35 }), i * 500)
  })
}

// ===== 主渲染函数 =====
export function initTeaching({ state, render: rerenderApp }) {
  function render() {
    const container = document.getElementById('main-content')
    let view
    if (currentView === 'home') view = homeView()
    else if (currentView === 'category') view = categoryView()
    else if (currentView === 'item') view = itemView(state)
    else view = homeView()
    
    container.innerHTML = ''
    container.appendChild(view)
  }
  
  // 注入渲染函数到模块作用域
  renderFn = render
  
  // 输入判定回调
  function onSubmit(dots) {
    if (currentView !== 'item') return
    if (currentPhase === 'learn') return // 学阶段不判定
    
    const cat = CURRICULUM[currentCategory]
    const section = cat.sections.find(s => s.id === currentSection)
    const items = section.items
    
    // 获取正确答案
    let correctCells = []
    if (currentCategory === 'pinyin') {
      if (currentSection === 'initials') correctCells = toCells(INITIALS[currentItem])
      else if (currentSection === 'finals') correctCells = toCells(FINALS[currentItem])
      else correctCells = toCells(syllableToDots(currentItem))
    } else if (currentCategory === 'latin') {
      correctCells = toCells(latinToDots(currentItem))
    } else if (currentCategory === 'symbols') {
      const table = currentSection === 'cn' ? SYMBOLS_CN : SYMBOLS_EN
      correctCells = toCells(table[currentItem])
    } else if (currentCategory === 'digits') {
      correctCells = toCells([[3,4,5,6], latinToDots(currentItem)])
    }
    
    const correct = gradeCells(correctCells, dots)
    if (correct) {
      speak('正确')
      if (currentPhase === 'practice') {
        // 练阶段答对即跳下一个
        const currentIndex = items.indexOf(currentItem)
        if (currentIndex < items.length - 1) {
          currentItem = items[currentIndex + 1]
          setCurrentItem(currentCategory, currentSection, currentItem)
          if (renderFn) renderFn()
        }
      }
    } else {
      const hint = keyHintForCells(correctCells)
      speak(`错误，正确答案是 ${currentItem}，键位 ${speakableDigits(hint)}`)
    }
    state.clearDots()
    rerenderApp()
  }
  
  return { view: render, onSubmit }
}
