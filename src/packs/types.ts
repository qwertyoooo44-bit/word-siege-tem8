export type PackMeta = {
  packId: string
  title: string
  description: string
  dialect: string
  level: string
  categories: string[]
  version: string
  source: string
  sourceRevision: string
  license: string
  attribution: string
  sha256: string
  entryCount: number
  readyCount: number
}

export type CourseMode = 'all-learnable' | 'pack' | 'chapter' | 'custom' | 'errors' | 'review'

export type Course = {
  id: string
  title: string
  packId: string
  wordIds: string[]
  dailyGoal: number
  mode: CourseMode
  createdAt: number
  updatedAt: number
}
