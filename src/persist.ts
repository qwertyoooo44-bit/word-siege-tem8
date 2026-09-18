import { fromPersist, toPersist } from './engine/machine'
import type { EngineState, PersistState } from './engine/types'

export const STORAGE_KEY = 'word-siege-tem8.phase1.v1'

export function loadState(): EngineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistState
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null
    return fromPersist(parsed)
  } catch {
    return null
  }
}

export function saveState(state: EngineState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist(state)))
  } catch {
    /* quota / private mode: keep running */
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
