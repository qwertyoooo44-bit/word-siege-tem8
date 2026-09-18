import type { CharacterMode } from './characters/cast'

export type KeyboardMode = 'app' | 'system'
export type SoundPackId = 'crisp' | 'mechanical' | 'archive' | 'crystal'
export type { CharacterMode }

export type AppSettings = {
  theme: 'dark' | 'light'
  fontScale: 's' | 'm' | 'l'
  dailyGoal: number
  autoSpeak: boolean
  speakAfterMaster: boolean
  speechRate: number
  keyboardMode: KeyboardMode
  largeKeys: boolean
  soundPack: SoundPackId
  keySoundEnabled: boolean
  resultSoundEnabled: boolean
  muted: boolean
  keyVolume: number
  resultVolume: number
  speechVolume: number
  characterVolume: number
  ambienceEnabled: boolean
  ambienceVolume: number
  characterMode: CharacterMode
  characterVoiceEnabled: boolean
  courseId: string
}

export const SETTINGS_KEY = 'word-siege-tem8.settings.v1'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontScale: 'm',
  dailyGoal: 5,
  autoSpeak: true,
  speakAfterMaster: true,
  speechRate: 0.92,
  keyboardMode: 'app',
  largeKeys: false,
  soundPack: 'crisp',
  keySoundEnabled: true,
  resultSoundEnabled: true,
  muted: false,
  keyVolume: 0.7,
  resultVolume: 0.8,
  speechVolume: 1,
  characterVolume: 0.85,
  ambienceEnabled: false,
  ambienceVolume: 0.2,
  characterMode: 'auto',
  characterVoiceEnabled: true,
  courseId: 'all-learnable',
}

function clamp01(n: unknown, fallback: number): number {
  const value = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const keyboardMode = parsed.keyboardMode === 'system' ? 'system' : 'app'
    const soundPack: SoundPackId =
      parsed.soundPack === 'mechanical' || parsed.soundPack === 'archive' || parsed.soundPack === 'crystal'
        ? parsed.soundPack
        : 'crisp'
    const characterMode: CharacterMode =
      parsed.characterMode === 'hidden' || parsed.characterMode === 'navigator' || parsed.characterMode === 'forger' || parsed.characterMode === 'archivist'
        ? parsed.characterMode
        : 'auto'
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keyboardMode,
      largeKeys: Boolean(parsed.largeKeys),
      soundPack,
      keySoundEnabled: parsed.keySoundEnabled !== false,
      resultSoundEnabled: parsed.resultSoundEnabled !== false,
      muted: Boolean(parsed.muted),
      keyVolume: clamp01(parsed.keyVolume, DEFAULT_SETTINGS.keyVolume),
      resultVolume: clamp01(parsed.resultVolume, DEFAULT_SETTINGS.resultVolume),
      speechVolume: clamp01(parsed.speechVolume, DEFAULT_SETTINGS.speechVolume),
      characterVolume: clamp01(parsed.characterVolume, DEFAULT_SETTINGS.characterVolume),
      ambienceEnabled: Boolean(parsed.ambienceEnabled),
      ambienceVolume: clamp01(parsed.ambienceVolume, DEFAULT_SETTINGS.ambienceVolume),
      characterMode,
      characterVoiceEnabled: parsed.characterVoiceEnabled !== false,
      courseId: typeof parsed.courseId === 'string' && parsed.courseId ? parsed.courseId : 'all-learnable',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
