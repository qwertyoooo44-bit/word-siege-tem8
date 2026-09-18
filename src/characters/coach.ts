import type { EngineEvent, EngineState } from '../engine/types'
import { currentWord } from '../engine/machine'
import { CHARACTERS, type CharacterId, type CharacterMode } from './cast'

export type CoachLine = {
  character: CharacterId
  text: string
  at: number
}

const COOLDOWN_MS = 20_000
const recent = new Map<string, number>()

function allowed(key: string, at: number): boolean {
  const prev = recent.get(key)
  if (prev != null && at - prev < COOLDOWN_MS) return false
  recent.set(key, at)
  return true
}

function pickCharacter(mode: CharacterMode, preferred: CharacterId): CharacterId | null {
  if (mode === 'hidden') return null
  if (mode === 'auto') return preferred
  return mode
}

function clusterHint(word: string): string | null {
  const clusters = ['tion', 'sion', 'ough', 'augh', 'ous', 'ight', 'ure', 'ance', 'ence', 'ible', 'able']
  const hit = clusters.find((c) => word.includes(c))
  return hit ? `-${hit}` : null
}

export function coachForEvents(
  prev: EngineState,
  events: EngineEvent[],
  mode: CharacterMode,
  at = Date.now(),
): CoachLine | null {
  const word = currentWord(prev)
  const cluster = clusterHint(word.word)
  for (const ev of events) {
    if (ev.type === 'word-mastered') {
      const character = pickCharacter(mode, 'navigator')
      if (!character) return null
      const text = cluster
        ? `「${word.word}」已攻克。刚才完整写下了 ${cluster}。`
        : `「${word.word}」已攻克。一次只进入下一个词。`
      if (!allowed(`master:${text}`, at)) return null
      return { character, text, at }
    }
    if (ev.type === 'stage-cleared' && (prev.stage === 'listen' || prev.stage === 'final')) {
      const character = pickCharacter(mode, 'navigator')
      if (!character || prev.usedHintThisAttempt) continue
      const text = '这一次没有使用提示，重音再听一遍即可。'
      if (!allowed(text, at)) return null
      return { character, text, at }
    }
    if (ev.type === 'letter-bad' && cluster && prev.consecutiveMistakes >= 1) {
      const character = pickCharacter(mode, 'forger')
      if (!character) return null
      const text = `注意 ${cluster}。提交前不会提示下一个字母。`
      if (!allowed(text, at)) return null
      return { character, text, at }
    }
    if (ev.type === 'help' && ev.kind === 'root') {
      const character = pickCharacter(mode, 'archivist')
      if (!character) return null
      const text = word.root ? `构词提示：${word.root}` : '本词暂无可靠词根，先按释义完整拼写。'
      if (!allowed(text, at)) return null
      return { character, text, at }
    }
    if (ev.type === 'need-unprompted') {
      const character = pickCharacter(mode, 'forger')
      if (!character) return null
      const text = '提示后的正确不计掌握。请再完整拼写一遍。'
      if (!allowed(text, at)) return null
      return { character, text, at }
    }
  }
  return null
}

export function greetingForWord(word: string, mode: CharacterMode, at = Date.now()): CoachLine | null {
  const character = pickCharacter(mode, 'archivist')
  if (!character) return null
  const text = `开始攻坚「${word}」。一次只处理这一个词。`
  if (!allowed(`enter:${word}`, at)) return null
  return { character, text, at }
}

export function characterLabel(id: CharacterId): string {
  return `${CHARACTERS[id].name} · ${CHARACTERS[id].role}`
}
