import type { WeekPreset } from '../domain/types'
import { readJson, writeJson } from './jsonStore'

const KEY = 'leedeli:weekPresets'
type Store = { items: WeekPreset[] }

export function loadWeekPresets(): WeekPreset[] {
  const r = readJson<Store>(KEY)
  if (!r.ok || !Array.isArray(r.value.items)) return []
  return r.value.items
}

export function upsertWeekPreset(next: WeekPreset): void {
  const items = loadWeekPresets()
  const idx = items.findIndex((x) => x.id === next.id)
  if (idx >= 0) items[idx] = next
  else items.unshift(next)
  writeJson<Store>(KEY, { items })
}

export function deleteWeekPreset(id: string): void {
  writeJson<Store>(KEY, { items: loadWeekPresets().filter((x) => x.id !== id) })
}
