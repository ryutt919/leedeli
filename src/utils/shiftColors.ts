// HSL 기반 동적 ShiftType 색상 배정
// 정직원: hue 210 (파랑 계열), 알바: hue 30 (주황 계열)
// totalShifts=1이면 채도 60(중간값), n>1이면 40~80 균등 분배

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

export function getShiftColor(
  role: '정직원' | '알바',
  shiftIndex: number,
  totalShifts: number
): string {
  const hue = role === '정직원' ? 210 : 30
  const minS = 40
  const maxS = 80
  const saturation =
    totalShifts <= 1
      ? 60
      : Math.round(minS + ((maxS - minS) * shiftIndex) / (totalShifts - 1))
  return hslToHex(hue, saturation, 45)
}
