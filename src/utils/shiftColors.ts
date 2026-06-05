export type ShiftPaletteColor = { bg: string; text: string }

// 정직원용 파란 계열 — 이미지 순서: 1,2,6,3,4,5
export const FULL_TIME_PALETTE: ShiftPaletteColor[] = [
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#E0F2FE', text: '#0369A1' },
  { bg: '#F0FDFA', text: '#0F766E' },
  { bg: '#E0E7FF', text: '#4338CA' },
  { bg: '#CCFBF1', text: '#0F766E' },
  { bg: '#D1FAE5', text: '#047857' },
]

// 알바용 주황 계열 — 이미지 순서: 1,2,3,4,5,6
export const PART_TIME_PALETTE: ShiftPaletteColor[] = [
  { bg: '#FFEDD5', text: '#C2410C' },
  { bg: '#FEF3C7', text: '#B45309' },
  { bg: '#FFE4E6', text: '#BE123C' },
  { bg: '#FEE2E2', text: '#B91C1C' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FDE68A', text: '#92400E' },
]

export function getShiftPaletteColor(
  shiftIndex: number,
  isPartTime: boolean
): ShiftPaletteColor {
  const palette = isPartTime ? PART_TIME_PALETTE : FULL_TIME_PALETTE
  return palette[shiftIndex % palette.length]
}
