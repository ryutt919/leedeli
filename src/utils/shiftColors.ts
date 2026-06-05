// ShiftType 이름 기반 고유 색상 배정
// 같은 이름 → 항상 같은 색, 오픈/미들/마감 등 서로 다른 색

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function stringToHue(name: string): number {
  let h = 5381
  for (const c of name) h = ((h << 5) + h) ^ c.charCodeAt(0)
  return ((h % 360) + 360) % 360
}

export function getShiftColor(shiftName: string): string {
  return hslToHex(stringToHue(shiftName), 65, 42)
}
