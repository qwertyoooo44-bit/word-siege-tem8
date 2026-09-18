export type AppSettings = {
  theme: 'dark' | 'light'
  fontScale: 's' | 'm' | 'l'
  dailyGoal: number
  autoSpeak: boolean
  speakAfterMaster: boolean
  speechRate: number
}

export const SETTINGS_KEY = 'word-siege-tem8.settings.v1'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontScale: 'm',
  dailyGoal: 5,
  autoSpeak: true,
  speakAfterMaster: true,
  speechRate: 0.92,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
