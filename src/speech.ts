export type SpeechStatus = {
  ready: boolean
  hasEnglish: boolean
  message: string
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang))
  if (!en.length) return null
  const us = en.find((v) => /en-US/i.test(v.lang) && /US|United States|Samantha|Alex|Google US/i.test(v.name))
  return us ?? en.find((v) => /en-US/i.test(v.lang)) ?? en[0]
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

export function speakWord(word: string, enabled: boolean, rate = 0.92): SpeechStatus {
  const status = inspectSpeech()
  if (!enabled) return { ...status, message: status.message || '美式系统发音已关闭。' }
  if (!status.ready || !('speechSynthesis' in window)) return status
  const voices = window.speechSynthesis.getVoices()
  const voice = pickVoice(voices)
  if (!voice) return status
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(word)
  u.lang = voice.lang || 'en-US'
  u.voice = voice
  u.rate = rate
  window.speechSynthesis.speak(u)
  return { ready: true, hasEnglish: true, message: '' }
}
