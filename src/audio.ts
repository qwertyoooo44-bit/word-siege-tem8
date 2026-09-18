import type { SoundPackId } from './settings'

type OscKind = OscillatorType

type Voice = {
  freq: number
  duration: number
  type: OscKind
  gain: number
  delay?: number
  noise?: boolean
}

type PackVoices = {
  key: Voice
  delete: Voice
  confirm: Voice
  ok: Voice
  bad: Voice
  stage: Voice[]
  master: Voice[]
}

const PACKS: Record<SoundPackId, PackVoices> = {
  crisp: {
    key: { freq: 980, duration: 0.045, type: 'sine', gain: 0.045 },
    delete: { freq: 240, duration: 0.06, type: 'triangle', gain: 0.05 },
    confirm: { freq: 620, duration: 0.07, type: 'sine', gain: 0.05 },
    ok: { freq: 880, duration: 0.07, type: 'sine', gain: 0.04 },
    bad: { freq: 180, duration: 0.09, type: 'triangle', gain: 0.05 },
    stage: [
      { freq: 523, duration: 0.12, type: 'sine', gain: 0.05 },
      { freq: 784, duration: 0.14, type: 'sine', gain: 0.045, delay: 0.08 },
    ],
    master: [
      { freq: 523, duration: 0.12, type: 'sine', gain: 0.05 },
      { freq: 659, duration: 0.12, type: 'sine', gain: 0.05, delay: 0.09 },
      { freq: 784, duration: 0.18, type: 'sine', gain: 0.05, delay: 0.18 },
    ],
  },
  mechanical: {
    key: { freq: 190, duration: 0.035, type: 'square', gain: 0.018, noise: true },
    delete: { freq: 140, duration: 0.05, type: 'square', gain: 0.02, noise: true },
    confirm: { freq: 220, duration: 0.06, type: 'square', gain: 0.022, noise: true },
    ok: { freq: 420, duration: 0.06, type: 'triangle', gain: 0.04 },
    bad: { freq: 110, duration: 0.08, type: 'sawtooth', gain: 0.03 },
    stage: [
      { freq: 330, duration: 0.08, type: 'triangle', gain: 0.04 },
      { freq: 495, duration: 0.1, type: 'triangle', gain: 0.04, delay: 0.07 },
    ],
    master: [
      { freq: 330, duration: 0.08, type: 'triangle', gain: 0.04 },
      { freq: 440, duration: 0.1, type: 'triangle', gain: 0.04, delay: 0.08 },
      { freq: 660, duration: 0.14, type: 'triangle', gain: 0.04, delay: 0.16 },
    ],
  },
  archive: {
    key: { freq: 760, duration: 0.05, type: 'triangle', gain: 0.03, noise: true },
    delete: { freq: 210, duration: 0.07, type: 'sine', gain: 0.035 },
    confirm: { freq: 410, duration: 0.08, type: 'triangle', gain: 0.04 },
    ok: { freq: 640, duration: 0.08, type: 'sine', gain: 0.035 },
    bad: { freq: 150, duration: 0.1, type: 'triangle', gain: 0.04 },
    stage: [
      { freq: 392, duration: 0.12, type: 'sine', gain: 0.04 },
      { freq: 523, duration: 0.14, type: 'sine', gain: 0.035, delay: 0.09 },
    ],
    master: [
      { freq: 349, duration: 0.12, type: 'sine', gain: 0.04 },
      { freq: 440, duration: 0.12, type: 'sine', gain: 0.04, delay: 0.1 },
      { freq: 523, duration: 0.16, type: 'sine', gain: 0.04, delay: 0.2 },
    ],
  },
  crystal: {
    key: { freq: 1180, duration: 0.04, type: 'sine', gain: 0.03 },
    delete: { freq: 300, duration: 0.05, type: 'sine', gain: 0.03 },
    confirm: { freq: 880, duration: 0.07, type: 'sine', gain: 0.035 },
    ok: { freq: 1320, duration: 0.08, type: 'sine', gain: 0.035 },
    bad: { freq: 220, duration: 0.08, type: 'triangle', gain: 0.04 },
    stage: [
      { freq: 784, duration: 0.1, type: 'sine', gain: 0.035 },
      { freq: 1175, duration: 0.12, type: 'sine', gain: 0.03, delay: 0.07 },
    ],
    master: [
      { freq: 659, duration: 0.1, type: 'sine', gain: 0.035 },
      { freq: 880, duration: 0.1, type: 'sine', gain: 0.035, delay: 0.08 },
      { freq: 1319, duration: 0.16, type: 'sine', gain: 0.03, delay: 0.16 },
    ],
  },
}

let ctx: AudioContext | null = null
let lastKeyAt = 0
let packId: SoundPackId = 'crisp'
let muted = false
let keyVolume = 0.7
let resultVolume = 0.8
let keySoundEnabled = true
let resultSoundEnabled = true
let activeSources = 0
const MAX_VOICES = 10

export const SOUND_PACK_LICENSE = {
  generator: 'src/audio.ts Web Audio oscillators',
  license: 'Original procedural audio; no third-party samples',
  copiedFrom: [],
} as const

export function configureAudio(options: {
  pack?: SoundPackId
  muted?: boolean
  keyVolume?: number
  resultVolume?: number
  keySoundEnabled?: boolean
  resultSoundEnabled?: boolean
}): void {
  if (options.pack) packId = options.pack
  if (options.muted != null) muted = options.muted
  if (options.keyVolume != null) keyVolume = options.keyVolume
  if (options.resultVolume != null) resultVolume = options.resultVolume
  if (options.keySoundEnabled != null) keySoundEnabled = options.keySoundEnabled
  if (options.resultSoundEnabled != null) resultSoundEnabled = options.resultSoundEnabled
}

export async function initAudio(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    ctx = null
  }
}

function jitter(n: number, amount: number): number {
  return n * (1 + (Math.random() * 2 - 1) * amount)
}

function playVoice(voice: Voice, volume: number) {
  if (!ctx || muted || volume <= 0 || activeSources >= MAX_VOICES) return
  const startAt = ctx.currentTime + (voice.delay ?? 0)
  const gainValue = Math.max(0.0001, jitter(voice.gain * volume, 0.08))
  const freq = jitter(voice.freq, 0.03)
  try {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainValue, startAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + voice.duration)
    gain.connect(ctx.destination)
    if (voice.noise && ctx.createBufferSource) {
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * voice.duration)), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.4
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = freq
      src.connect(filter)
      filter.connect(gain)
      activeSources += 1
      src.onended = () => {
        activeSources = Math.max(0, activeSources - 1)
      }
      src.start(startAt)
      src.stop(startAt + voice.duration)
    }
    const osc = ctx.createOscillator()
    osc.type = voice.type
    osc.frequency.value = freq
    osc.connect(gain)
    activeSources += 1
    osc.onended = () => {
      activeSources = Math.max(0, activeSources - 1)
    }
    osc.start(startAt)
    osc.stop(startAt + voice.duration)
  } catch {
    /* audio must never block typing */
  }
}

function pack(): PackVoices {
  return PACKS[packId] ?? PACKS.crisp
}

function playKeyKind(kind: 'key' | 'delete' | 'confirm') {
  if (!keySoundEnabled || muted) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (kind === 'key' && now - lastKeyAt < 18) return
  lastKeyAt = now
  playVoice(pack()[kind], keyVolume)
}

export function playKey(enabled = true) {
  if (!enabled) return
  playKeyKind('key')
}

export function playDelete(enabled = true) {
  if (!enabled) return
  playKeyKind('delete')
}

export function playConfirm(enabled = true) {
  if (!enabled) return
  playKeyKind('confirm')
}

export function playOk(enabled: boolean) {
  if (!enabled || !resultSoundEnabled || muted) return
  playVoice(pack().ok, resultVolume)
}

export function playBad(enabled: boolean) {
  if (!enabled || !resultSoundEnabled || muted) return
  playVoice(pack().bad, resultVolume)
}

export function playStage(enabled: boolean) {
  if (!enabled || !resultSoundEnabled || muted) return
  for (const voice of pack().stage) playVoice(voice, resultVolume)
}

export function playMaster(enabled: boolean) {
  if (!enabled || !resultSoundEnabled || muted) return
  for (const voice of pack().master) playVoice(voice, resultVolume)
}

export function soundPackIds(): SoundPackId[] {
  return ['crisp', 'mechanical', 'archive', 'crystal']
}
