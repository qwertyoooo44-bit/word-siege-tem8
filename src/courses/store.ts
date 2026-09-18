import { db } from '../db/database'
import { SAMPLE_PACK, TEM8_PACK, wordIdsForPack } from '../packs/catalog'
import type { Course } from '../packs/types'

export const ALL_LEARNABLE_COURSE_ID = 'all-learnable'
export const SAMPLE_COURSE_ID = 'tem8-sample-40'
export const REVIEW_COURSE_ID = 'review-due'
export const ERRORS_COURSE_ID = 'errors-only'

export function builtinCourses(): Course[] {
  const now = 0
  return [
    {
      id: ALL_LEARNABLE_COURSE_ID,
      title: '全部可学词',
      packId: TEM8_PACK.packId,
      wordIds: wordIdsForPack(TEM8_PACK.packId),
      dailyGoal: 5,
      mode: 'all-learnable',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SAMPLE_COURSE_ID,
      title: SAMPLE_PACK.title,
      packId: SAMPLE_PACK.packId,
      wordIds: wordIdsForPack(SAMPLE_PACK.packId),
      dailyGoal: 5,
      mode: 'pack',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: REVIEW_COURSE_ID,
      title: '只做复习',
      packId: TEM8_PACK.packId,
      wordIds: [],
      dailyGoal: 5,
      mode: 'review',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ERRORS_COURSE_ID,
      title: '只练错词',
      packId: TEM8_PACK.packId,
      wordIds: [],
      dailyGoal: 5,
      mode: 'errors',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export async function listCustomCourses(): Promise<Course[]> {
  try {
    return await db.courses.toArray()
  } catch {
    return []
  }
}

export async function saveCustomCourse(course: Course): Promise<void> {
  await db.courses.put(course)
}

export async function deleteCustomCourse(id: string): Promise<void> {
  await db.courses.delete(id)
}

export async function exportCourse(course: Course): Promise<string> {
  return JSON.stringify(
    {
      title: course.title,
      packId: course.packId,
      wordIds: course.wordIds,
      license: 'User-authored course list; word content remains with original pack licenses.',
    },
    null,
    2,
  )
}
