import Dexie, { type EntityTable } from 'dexie'
import type { DailyStat, WordRecord } from '../review/schedule'
import type { PersistV2 } from '../engine/types'

export const DB_NAME = 'word-siege-tem8'
export const SCHEMA_VERSION = 1

export type MetaRow = {
  id: 'app'
  schemaVersion: number
}

export type CurrentRow = {
  id: 'siege'
  persist: PersistV2
}

export class WordSiegeDB extends Dexie {
  meta!: EntityTable<MetaRow, 'id'>
  current!: EntityTable<CurrentRow, 'id'>
  words!: EntityTable<WordRecord, 'wordId'>
  daily!: EntityTable<DailyStat, 'date'>

  constructor() {
    super(DB_NAME)
    this.version(SCHEMA_VERSION).stores({
      meta: 'id',
      current: 'id',
      words: 'wordId, status, nextReviewAt',
      daily: 'date',
    })
  }
}

export const db = new WordSiegeDB()
