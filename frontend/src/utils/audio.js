let audioCtx = null

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export function playDoorbellChime() {
  try {
    const ctx = getAudioContext()
    // Traditional two-tone doorbell: E5 (659 Hz) then C5 (523 Hz)
    const tones = [
      { freq: 659, start: 0,    duration: 0.4 },
      { freq: 523, start: 0.45, duration: 0.6 },
    ]
    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    })
  } catch (e) {
    console.warn('Audio playback failed:', e)
  }
}
