import type { ExtraWork } from '../domain/types'
import { getStore, setStore } from './jsonStore'
import { KEYS } from './keys'

export function loadExtraWorks(): ExtraWork[] {
  return getStore<ExtraWork[]>(KEYS.extraWorks) ?? []
}

export function saveExtraWorks(works: ExtraWork[]): void {
  setStore(KEYS.extraWorks, works)
}

export function upsertExtraWork(work: ExtraWork): void {
  const works = loadExtraWorks()
  const idx = works.findIndex(w => w.id === work.id)
  if (idx >= 0) {
    works[idx] = work
  } else {
    works.push(work)
  }
  saveExtraWorks(works)
}

export function deleteExtraWork(id: string): void {
  const works = loadExtraWorks().filter(w => w.id !== id)
  saveExtraWorks(works)
}

export function getExtraWorksBySchedule(scheduleId: string): ExtraWork[] {
  return loadExtraWorks().filter(w => w.scheduleId === scheduleId)
}

export function getExtraWorksByScheduleAndDate(scheduleId: string, dateISO: string): ExtraWork[] {
  return loadExtraWorks().filter(w => w.scheduleId === scheduleId && w.dateISO === dateISO)
}
