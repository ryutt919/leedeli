import type { WorkRules } from '../domain/types'
import { readJson, writeJson } from './jsonStore'
import { LS_KEYS } from './keys'

export const DEFAULT_WORK_RULES: WorkRules = {
  DAILY_STAFF_BASE: 2,
  DAILY_STAFF_MAX: 3,
  WORK_HOURS: 8,
  BREAK_HOURS: 1,
}

export function loadWorkRules(): WorkRules {
  const r = readJson<WorkRules>(LS_KEYS.workRules)
  if (!r.ok) return DEFAULT_WORK_RULES
  const v = r.value
  // sanitize numeric fields to avoid fractional staff values from older saves
  const sanitized: WorkRules = {
    ...v,
    DAILY_STAFF_BASE: Math.max(1, Math.floor(Number(v.DAILY_STAFF_BASE) || 0)),
    DAILY_STAFF_MAX: Math.max(1, Math.floor(Number(v.DAILY_STAFF_MAX) || 0)),
    WORK_HOURS: Number(v.WORK_HOURS) || DEFAULT_WORK_RULES.WORK_HOURS,
    BREAK_HOURS: Number(v.BREAK_HOURS) || DEFAULT_WORK_RULES.BREAK_HOURS,
  }
  return sanitized
}

export function saveWorkRules(rules: WorkRules) {
  // ensure stored values are integers for headcounts
  const toSave = {
    ...rules,
    DAILY_STAFF_BASE: Math.max(1, Math.floor(Number(rules.DAILY_STAFF_BASE) || 0)),
    DAILY_STAFF_MAX: Math.max(1, Math.floor(Number(rules.DAILY_STAFF_MAX) || 0)),
  }
  writeJson(LS_KEYS.workRules, toSave)
}


