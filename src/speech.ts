export type SpeechStatus = {
  ready: boolean
  hasEnglish: boolean
  message: string
}

type SpeakOptions = {
  rate?: number
  pitch?: number
  volume?: number
  lang?: string
}

let speakingKind: 'word' | 'coach' | null = null

function pickVoice(voices: SpeechSynthesisVoice[], langPrefix = 'en'): SpeechSynthesisVoice | null {
  const matched = voices.filter((v) => new RegExp(`^${langPrefix}(-|_|$)`, 'i').test(v.lang))
  if (!matched.length) return null
  if (langPrefix === 'en') {
    const us = matched.find((v) => /en-US/i.test(v.lang) && /US|United States|Samantha|Alex|Google US/i.test(v.name))
    return us ?? matched.find((v) => /en-US/i.test(v.lang)) ?? matched[0]
  }
  return matched[0]
}

export function inspectSpeech(): SpeechStatus {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { ready: false, hasEnglish: false, message: '此设备没有可用的美式系统发音。' }
  }
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) {
    return { ready: true, hasEnglish: false, message: '正在读取系统语音，请再点一次美式系统发音。' }
  }
  const voice = pickVoice(voices)
  if (!voice) {
    return { ready: true, hasEnglish: false, message: '没有可用的英语语音，无法听音拼写。' }
  }
  return { ready: true, hasEnglish: true, message: '' }
}

function speakUtterance(text: string, kind: 'word' | 'coach', options: SpeakOptions): SpeechStatus {
  const status = inspectSpeech()
  if (!status.ready || !('speechSynthesis' in window)) return status
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = (options.lang || 'en-US').slice(0, 2)
  const voice = pickVoice(voices, langPrefix) ?? pickVoice(voices)
  if (!voice && kind === 'word') return status
  if (kind === 'word' || speakingKind !== 'word') {
    window.speechSynthesis.cancel()
  } else {
    return status
  }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = options.lang || voice?.lang || 'en-US'
  if (voice) u.voice = voice
  u.rate = options.rate ?? 0.92
  u.pitch = options.pitch ?? 1
  u.volume = Math.min(1, Math.max(0, options.volume ?? 1))
  speakingKind = kind
  u.onend = () => {
    if (speakingKind === kind) speakingKind = null
  }
  u.onerror = () => {
    if (speakingKind === kind) speakingKind = null
  }
  window.speechSynthesis.speak(u)
  return { ready: true, hasEnglish: Boolean(pickVoice(voices)), message: '' }
}

export function speakWord(word: string, enabled: boolean, rate = 0.92, volume = 1): SpeechStatus {
  const status = inspectSpeech()
  if (!enabled) return { ...status, message: status.message || '美式系统发音已关闭。' }
  return speakUtterance(word, 'word', { rate, volume, lang: 'en-US', pitch: 1 })
}

export function speakCoachLine(text: string, enabled: boolean, rate = 0.95, pitch = 1, volume = 0.85): SpeechStatus {
  if (!enabled) return inspectSpeech()
  if (speakingKind === 'word') return inspectSpeech()
  return speakUtterance(text, 'coach', { rate, pitch, volume, lang: 'zh-CN' })
}
