// src/audio-braille.js
// 编码规则（硬编码，来自规格第 6 节）：
//   空间：左列点(1,2,3)→-90°(左耳)，右列点(4,5,6)→+90°(右耳)
//   音高：上行(1,4)=600Hz，中行(2,5)=400Hz，下行(3,6)=250Hz
//   波形：左列正弦，右列方波（单声道也能区分左右列）

export const PAN = { LEFT: -90, RIGHT: 90 }

const FREQ = { 1: 600, 2: 400, 3: 250, 4: 600, 5: 400, 6: 250 }
const WAVE = { 1: 'sine', 2: 'sine', 3: 'sine', 4: 'square', 5: 'square', 6: 'square' }

export function buildChordNotes(dots) {
  return dots.map(d => ({ dot: d, freq: FREQ[d], wave: WAVE[d], pan: d <= 3 ? PAN.LEFT : PAN.RIGHT }))
}

let audioCtx = null
let master = null

// 首次键盘敲击解锁（见 app.js 调用）
export function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    audioCtx = new AC()
    master = audioCtx.createGain()
    master.gain.value = 0.5
    master.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  // 极短静音缓冲强制解锁
  const buf = audioCtx.createBuffer(1, 1, 44100)
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  src.connect(master)
  src.start()
}

export function isAudioReady() {
  return !!(audioCtx && audioCtx.state === 'running')
}

// 播放一点阵的和弦（0.25s，有点的音符同时响起）
// 可选 onDot(dot, on) 回调用于屏幕高亮
// 返回 Promise，播放结束 resolve（便于顺序演奏笔记）
export function playAudioBraille(dotsArray, { duration = 0.25, onDot = null } = {}) {
  if (!audioCtx) unlockAudio()
  if (!audioCtx || audioCtx.state !== 'running') return Promise.resolve()

  const notes = buildChordNotes(dotsArray)
  const start = audioCtx.currentTime + 0.02
  const stop = start + duration

  notes.forEach(n => {
    const osc = audioCtx.createOscillator()
    osc.type = n.wave
    osc.frequency.value = n.freq
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = n.pan / 90   // StereoPanner 范围 [-1,1]
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.4, start)
    gain.gain.exponentialRampToValueAtTime(0.001, stop)  // 短促衰减防爆音
    osc.connect(panner).connect(gain).connect(master)
    osc.start(start)
    osc.stop(stop)
    onDot?.(n.dot, true)
    osc.onended = () => onDot?.(n.dot, false)
  })

  return new Promise(res => setTimeout(res, duration * 1000 + 60))
}
