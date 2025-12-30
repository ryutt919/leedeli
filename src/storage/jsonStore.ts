type ReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'parse_error' }

export function readJson<T>(key: string): ReadResult<T> {
  const raw = localStorage.getItem(key)
  if (!raw) return { ok: false, reason: 'missing' }
  try {
    return { ok: true, value: JSON.parse(raw) as T }
  } catch {
    return { ok: false, reason: 'parse_error' }
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getStore<T>(key: string): T | null {
  const result = readJson<T>(key)
  return result.ok ? result.value : null
}

export function setStore<T>(key: string, value: T): void {
  writeJson(key, value)
}



