let ctx: AudioContext | null = null

export async function initAudio(): Promise<void> {
  if (typeof window === 'undefined') return
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = ctx ?? new AC()
  if (ctx.state === 'suspended') await ctx.resume()
}

function beep(freq: number, duration: number, type: OscillatorType, gainValue: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(gainValue, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export function playOk(enabled: boolean) {
  if (!enabled) return
  beep(880, 0.07, 'sine', 0.04)
}

export function playBad(enabled: boolean) {
  if (!enabled) return
  beep(180, 0.09, 'triangle', 0.05)
}

export function playStage(enabled: boolean) {
  if (!enabled) return
  beep(523, 0.12, 'sine', 0.05)
  setTimeout(() => beep(784, 0.14, 'sine', 0.045), 80)
}

export function playMaster(enabled: boolean) {
  if (!enabled) return
  beep(523, 0.12, 'sine', 0.05)
  setTimeout(() => beep(659, 0.12, 'sine', 0.05), 90)
  setTimeout(() => beep(784, 0.18, 'sine', 0.05), 180)
}
