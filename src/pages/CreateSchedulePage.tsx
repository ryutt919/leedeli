import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  theme,
} from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import type { Dayjs } from 'dayjs'
import { MobileShell } from '../layouts/MobileShell'
import { useAuth } from '../auth/AuthContext'
import type {
  Employee,
  ScheduleEntry,
  ScheduleV3,
  ShiftType,
  WeekPreset,
} from '../domain/types'
import { loadEmployees, upsertEmployee, deleteEmployee } from '../storage/employeesRepo'
import { loadShiftTypes, upsertShiftType, deleteShiftType } from '../storage/shiftTypesRepo'
import { upsertScheduleV3, loadSchedulesV3, deleteScheduleV3 } from '../storage/schedulesRepo'
import { generateScheduleV3, calcEmployeeSummary } from '../domain/scheduleEngineV3'
import {
  loadWeekPresets,
  upsertWeekPreset,
  deleteWeekPreset,
} from '../storage/weekPresetsRepo'

const { Text } = Typography
const { RangePicker } = DatePicker

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type HslColor = { h: number; s: number; l: number }

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(hex: string): string | null {
  const raw = hex.trim().replace('#', '')
  if (raw.length === 3) {
    const expanded = raw.split('').map((c) => c + c).join('')
    return `#${expanded.toLowerCase()}`
  }
  if (raw.length === 6) return `#${raw.toLowerCase()}`
  return null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  return { r, g, b }
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): HslColor {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex({ h, s, l }: HslColor): string {
  const sat = clampNumber(s, 0, 100) / 100
  const light = clampNumber(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0 }
  else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0 }
  else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x }
  else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c }
  else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`
}

function buildShiftPalette(count: number, baseHex: string): string[] {
  if (count <= 0) return []
  const baseColor = normalizeHex(baseHex) ?? '#1677ff'
  if (count === 1) return [baseColor]
  const baseRgb = hexToRgb(baseColor)
  const baseHsl = baseRgb ? rgbToHsl(baseRgb) : { h: 215, s: 60, l: 45 }
  const s = clampNumber(baseHsl.s, 45, 70)
  const l = clampNumber(baseHsl.l, 38, 52)
  const step = 360 / count
  return Array.from({ length: count }, (_, idx) => {
    const h = (baseHsl.h + idx * step) % 360
    return hslToHex({ h, s, l })
  })
}

function buildShiftTypeColorMap(
  shiftTypes: ShiftType[],
  baseHex: string,
  partTimeHex: string
): Map<string, string> {
  const map = new Map<string, string>()
  const partTimeColor = normalizeHex(partTimeHex) ?? '#faad14'
  const regularTypes = shiftTypes.filter((st) => st.targetRole !== '알바')
  const partTimeTypes = shiftTypes.filter((st) => st.targetRole === '알바')
  const palette = buildShiftPalette(regularTypes.length, baseHex)
  regularTypes.forEach((st, idx) => {
    map.set(st.id, palette[idx])
  })
  partTimeTypes.forEach((st) => {
    map.set(st.id, partTimeColor)
  })
  return map
}

function newId() {
  return crypto.randomUUID()
}

function timeLabel(entry: ScheduleEntry): string {
  return entry.shiftTypeName
    ? `${entry.shiftTypeName} (${entry.startTime}-${entry.endTime})`
    : `${entry.startTime}-${entry.endTime}`
}

// ─── ShiftType 모달 ─────────────────────────────────────────────
function ShiftTypeModal({
  open,
  initial,
  onOk,
  onCancel,
}: {
  open: boolean
  initial?: ShiftType | null
  onOk: (v: ShiftType) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (open) {
      setHasError(false)
      form.setFieldsValue(
        initial
          ? { ...initial }
          : { name: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60, staffCount: 1, targetRole: '전체' }
      )
    }
  }, [open, initial, form])

  const handleOk = async () => {
    setHasError(false)
    try {
      const values = await form.validateFields()
      onOk({
        id: initial?.id ?? newId(),
        updatedAtISO: new Date().toISOString(),
        ...values,
      } as ShiftType)
    } catch {
      setHasError(true)
    }
  }

  return (
    <Modal
      title={initial ? '근무유형 수정' : '근무유형 추가'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="저장"
      cancelText="취소"
    >
      {hasError && (
        <Alert message="필수 항목을 입력해주세요" type="warning" showIcon style={{ marginBottom: 12 }} />
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="이름" rules={[{ required: true, message: '이름 입력' }]}>
          <Input placeholder="오픈" />
        </Form.Item>
        <Flex gap={8}>
          <Form.Item name="startTime" label="시작 (HH:MM)" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="09:00" maxLength={5} />
          </Form.Item>
          <Form.Item name="endTime" label="종료 (HH:MM)" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="18:00" maxLength={5} />
          </Form.Item>
        </Flex>
        <Flex gap={8}>
          <Form.Item name="breakMinutes" label="휴식(분)" style={{ flex: 1 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="staffCount" label="필요인원" style={{ flex: 1 }}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Flex>
        <Form.Item name="targetRole" label="적용 대상">
          <Select
            options={[
              { value: '전체', label: '전체 (정직원+알바)' },
              { value: '정직원', label: '정직원 전용' },
              { value: '알바', label: '알바 전용' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Employee 모달 ─────────────────────────────────────────────
function EmployeeModal({
  open,
  initial,
  shiftTypes,
  isAdmin,
  onOk,
  onCancel,
}: {
  open: boolean
  initial?: Employee | null
  shiftTypes: ShiftType[]
  isAdmin: boolean
  onOk: (v: Employee) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  const [hasError, setHasError] = useState(false)
  const role = Form.useWatch('role', form)

  useEffect(() => {
    if (open) {
      setHasError(false)
      form.setFieldsValue(
        initial
          ? { ...initial, workPatterns: initial.workPatterns ?? [] }
          : {
              name: '',
              role: '정직원',
              defaultBreakMinutes: 60,
              availableShiftIds: [],
              regularDaysOff: [],
              workPatterns: [],
            }
      )
    }
  }, [open, initial, form])

  const handleOk = async () => {
    setHasError(false)
    try {
      const values = await form.validateFields()
      onOk({
        id: initial?.id ?? newId(),
        updatedAtISO: new Date().toISOString(),
        hourlyWage: initial?.hourlyWage ?? 0,
        availableShiftIds: values.availableShiftIds ?? [],
        regularDaysOff: values.regularDaysOff ?? [],
        workPatterns: values.workPatterns ?? [],
        ...values,
      } as Employee)
    } catch {
      setHasError(true)
    }
  }

  return (
    <Modal
      title={initial ? '직원 수정' : '직원 추가'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="저장"
      cancelText="취소"
      width={480}
    >
      {hasError && (
        <Alert message="필수 항목을 입력해주세요" type="warning" showIcon style={{ marginBottom: 12 }} />
      )}
      <Form form={form} layout="vertical">
        <Flex gap={8}>
          <Form.Item name="name" label="이름" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="홍길동" />
          </Form.Item>
          <Form.Item name="role" label="구분" style={{ width: 100 }}>
            <Select options={[{ value: '정직원' }, { value: '알바' }]} />
          </Form.Item>
        </Flex>

        {isAdmin && (
          <Form.Item name="defaultBreakMinutes" label="기본휴식(분)" style={{ width: 160 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {role === '정직원' && (
          <>
            <Form.Item name="availableShiftIds" label="가능 근무유형">
              <Checkbox.Group
                options={shiftTypes
                  .filter((st) => !st.targetRole || st.targetRole === '전체' || st.targetRole === '정직원')
                  .map((st) => ({ label: `${st.name} (${st.startTime}-${st.endTime})`, value: st.id }))}
              />
            </Form.Item>
            <Form.Item name="regularDaysOff" label="정기휴무 요일">
              <Checkbox.Group
                options={WEEKDAY_LABELS.map((label, idx) => ({ label, value: idx }))}
              />
            </Form.Item>
          </>
        )}

        {role === '알바' && (
          <>
            <Form.Item name="availableShiftIds" label="가능 근무유형">
              <Checkbox.Group
                options={shiftTypes
                  .filter((st) => !st.targetRole || st.targetRole === '전체' || st.targetRole === '알바')
                  .map((st) => ({ label: `${st.name} (${st.startTime}-${st.endTime})`, value: st.id }))}
              />
            </Form.Item>
            <Form.Item name="regularDaysOff" label="정기휴무 요일">
              <Checkbox.Group
                options={WEEKDAY_LABELS.map((label, idx) => ({ label, value: idx }))}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}

// ─── 주간 프리셋 모달 ─────────────────────────────────────────────
type DayMode = 'default' | 'specific' | 'off'
type PresetDayState = { mode: DayMode; shiftIds: string[] }

function buildDayStatesFromConfig(cfg: Partial<Record<number, string[]>> | undefined): Record<number, PresetDayState> {
  const result: Record<number, PresetDayState> = {}
  for (let d = 0; d < 7; d++) {
    if (!cfg || !(d in cfg)) {
      result[d] = { mode: 'default', shiftIds: [] }
    } else {
      const c = cfg[d]!
      result[d] = c.length === 0 ? { mode: 'off', shiftIds: [] } : { mode: 'specific', shiftIds: c }
    }
  }
  return result
}

function dayStatesToConfig(states: Record<number, PresetDayState>): Partial<Record<number, string[]>> {
  const result: Partial<Record<number, string[]>> = {}
  for (let d = 0; d < 7; d++) {
    const st = states[d]
    if (st.mode === 'off') result[d] = []
    else if (st.mode === 'specific') result[d] = st.shiftIds
  }
  return result
}

function WeekPresetModal({
  open,
  initial,
  shiftTypes,
  onOk,
  onCancel,
}: {
  open: boolean
  initial?: WeekPreset | null
  shiftTypes: ShiftType[]
  onOk: (v: WeekPreset) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [activeWeekIdx, setActiveWeekIdx] = useState<number>(-1) // -1 = 전체 기본
  const [configuredWeeks, setConfiguredWeeks] = useState<number[]>([])
  const [defaultStates, setDefaultStates] = useState<Record<number, PresetDayState>>(
    () => buildDayStatesFromConfig(undefined)
  )
  const [weekStates, setWeekStates] = useState<Record<number, Record<number, PresetDayState>>>({})

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setNameError(false)
      setActiveWeekIdx(-1)
      setDefaultStates(buildDayStatesFromConfig(initial?.dayConfig))
      if (initial?.weekOverrides) {
        const weeks = Object.keys(initial.weekOverrides).map(Number).sort((a, b) => a - b)
        setConfiguredWeeks(weeks)
        const states: Record<number, Record<number, PresetDayState>> = {}
        for (const w of weeks) {
          states[w] = buildDayStatesFromConfig(initial.weekOverrides[w])
        }
        setWeekStates(states)
      } else {
        setConfiguredWeeks([])
        setWeekStates({})
      }
    }
  }, [open, initial])

  const currentStates =
    activeWeekIdx === -1
      ? defaultStates
      : (weekStates[activeWeekIdx] ?? buildDayStatesFromConfig(undefined))

  const setDayMode = (day: number, mode: DayMode) => {
    if (activeWeekIdx === -1) {
      setDefaultStates((prev) => ({ ...prev, [day]: { ...prev[day], mode } }))
    } else {
      const base = weekStates[activeWeekIdx] ?? buildDayStatesFromConfig(undefined)
      setWeekStates((prev) => ({
        ...prev,
        [activeWeekIdx]: { ...base, [day]: { ...base[day], mode } },
      }))
    }
  }

  const setDayShifts = (day: number, shiftIds: string[]) => {
    if (activeWeekIdx === -1) {
      setDefaultStates((prev) => ({ ...prev, [day]: { ...prev[day], shiftIds } }))
    } else {
      const base = weekStates[activeWeekIdx] ?? buildDayStatesFromConfig(undefined)
      setWeekStates((prev) => ({
        ...prev,
        [activeWeekIdx]: { ...base, [day]: { ...base[day], shiftIds } },
      }))
    }
  }

  const addWeek = (weekIdx: number) => {
    if (configuredWeeks.includes(weekIdx)) return
    setConfiguredWeeks((prev) => [...prev, weekIdx].sort((a, b) => a - b))
    setWeekStates((prev) => ({ ...prev, [weekIdx]: buildDayStatesFromConfig(undefined) }))
    setActiveWeekIdx(weekIdx)
  }

  const removeWeek = (weekIdx: number) => {
    setConfiguredWeeks((prev) => prev.filter((w) => w !== weekIdx))
    setWeekStates((prev) => {
      const next = { ...prev }
      delete next[weekIdx]
      return next
    })
    if (activeWeekIdx === weekIdx) setActiveWeekIdx(-1)
  }

  const handleOk = () => {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    const dayConfig = dayStatesToConfig(defaultStates)
    const weekOverrides: Partial<Record<number, Partial<Record<number, string[]>>>> = {}
    for (const weekIdx of configuredWeeks) {
      const states = weekStates[weekIdx]
      if (!states) continue
      const cfg = dayStatesToConfig(states)
      if (Object.keys(cfg).length > 0) weekOverrides[weekIdx] = cfg
    }
    onOk({
      id: initial?.id ?? newId(),
      name: name.trim(),
      dayConfig,
      weekOverrides: Object.keys(weekOverrides).length > 0 ? weekOverrides : undefined,
      updatedAtISO: new Date().toISOString(),
    })
  }

  const availableWeekOptions = [0, 1, 2, 3, 4, 5]
    .filter((w) => !configuredWeeks.includes(w))
    .map((w) => ({ value: w, label: `${w + 1}주차` }))

  return (
    <Modal
      title={initial ? '프리셋 수정' : '프리셋 추가'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="저장"
      cancelText="취소"
      width={560}
    >
      <Flex vertical gap={12}>
        {/* 이름 */}
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>프리셋 이름</Text>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false) }}
            placeholder="기본 주간 편성"
            status={nameError ? 'error' : ''}
          />
          {nameError && <Text type="danger" style={{ fontSize: 12 }}>이름을 입력해주세요</Text>}
        </div>

        {/* 주차 탭 */}
        <div>
          <Text style={{ display: 'block', marginBottom: 6 }}>주차 선택</Text>
          <Flex gap={4} wrap>
            <Tag
              color={activeWeekIdx === -1 ? 'blue' : undefined}
              onClick={() => setActiveWeekIdx(-1)}
              style={{ cursor: 'pointer', fontWeight: activeWeekIdx === -1 ? 600 : undefined }}
            >
              전체 기본
            </Tag>
            {configuredWeeks.map((weekIdx) => (
              <Tag
                key={weekIdx}
                color={activeWeekIdx === weekIdx ? 'blue' : 'geekblue'}
                closable
                onClose={(e) => { e.preventDefault(); removeWeek(weekIdx) }}
                onClick={() => setActiveWeekIdx(weekIdx)}
                style={{ cursor: 'pointer', fontWeight: activeWeekIdx === weekIdx ? 600 : undefined }}
              >
                {weekIdx + 1}주차
              </Tag>
            ))}
            {availableWeekOptions.length > 0 && (
              <Select
                placeholder="+ 주차 추가"
                size="small"
                value={null}
                style={{ width: 100 }}
                onChange={addWeek}
                options={availableWeekOptions}
              />
            )}
          </Flex>
          {activeWeekIdx >= 0 && (
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
              '기본 따름' 요일은 전체 기본 설정을 따릅니다.
            </Text>
          )}
        </div>

        {/* 요일별 설정 */}
        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>
            {activeWeekIdx === -1 ? '요일별 근무유형 (전체 주 기본)' : `${activeWeekIdx + 1}주차 요일별 설정`}
          </Text>
          <Flex vertical gap={6}>
            {WEEKDAY_LABELS.map((label, day) => {
              const st = currentStates[day] ?? { mode: 'default', shiftIds: [] }
              return (
                <Flex key={day} gap={8} align="flex-start" style={{ padding: '8px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                  <Text style={{
                    width: 20,
                    fontWeight: 600,
                    paddingTop: 4,
                    color: day === 0 ? '#cf1322' : day === 6 ? '#096dd9' : undefined,
                  }}>
                    {label}
                  </Text>
                  <Flex vertical gap={6} style={{ flex: 1 }}>
                    <Radio.Group
                      value={st.mode}
                      onChange={(e) => setDayMode(day, e.target.value as DayMode)}
                      size="small"
                    >
                      <Radio.Button value="default">
                        {activeWeekIdx === -1 ? '자동' : '기본 따름'}
                      </Radio.Button>
                      <Radio.Button value="specific">특정</Radio.Button>
                      <Radio.Button value="off">휴무</Radio.Button>
                    </Radio.Group>
                    {st.mode === 'specific' && shiftTypes.length > 0 && (
                      <Checkbox.Group
                        value={st.shiftIds}
                        onChange={(v) => setDayShifts(day, v as string[])}
                        options={shiftTypes.map((s) => ({ label: s.name, value: s.id }))}
                      />
                    )}
                    {st.mode === 'specific' && shiftTypes.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>먼저 근무유형을 추가해주세요</Text>
                    )}
                  </Flex>
                </Flex>
              )
            })}
          </Flex>
        </div>
      </Flex>
    </Modal>
  )
}

function presetSummary(preset: WeekPreset, shiftTypes: ShiftType[]): string {
  const parts: string[] = []
  for (let d = 0; d < 7; d++) {
    const cfg = preset.dayConfig[d]
    if (cfg === undefined) continue
    if (cfg.length === 0) {
      parts.push(`${WEEKDAY_LABELS[d]}:휴무`)
    } else {
      const names = cfg.map((id) => shiftTypes.find((s) => s.id === id)?.name ?? '?').join('+')
      parts.push(`${WEEKDAY_LABELS[d]}:${names}`)
    }
  }
  const base = parts.length === 0 ? '기본 (전체 적용)' : parts.join(' / ')
  const overrideCount = preset.weekOverrides ? Object.keys(preset.weekOverrides).length : 0
  return overrideCount > 0 ? `${base} +${overrideCount}주 개별설정` : base
}

// ─── 날짜 셀 편집 모달 ────────────────────────────────────────────
function DayEditModal({
  open,
  dateISO,
  entries,
  employees,
  shiftTypes,
  onOk,
  onCancel,
}: {
  open: boolean
  dateISO: string
  entries: ScheduleEntry[]
  employees: Employee[]
  shiftTypes: ShiftType[]
  onOk: (dateISO: string, updated: ScheduleEntry[]) => void
  onCancel: () => void
}) {
  const [local, setLocal] = useState<ScheduleEntry[]>([])
  const [addEmpId, setAddEmpId] = useState<string | null>(null)
  const [addShiftId, setAddShiftId] = useState<string | null>(null)
  const [addStart, setAddStart] = useState('09:00')
  const [addEnd, setAddEnd] = useState('18:00')
  const [addBreak, setAddBreak] = useState(60)
  const [addNote, setAddNote] = useState('')

  useEffect(() => {
    if (open) {
      setLocal([...entries])
      setAddEmpId(null)
      setAddShiftId(null)
      setAddNote('')
    }
  }, [open, entries])

  const handleShiftSelect = (shiftId: string) => {
    setAddShiftId(shiftId)
    const st = shiftTypes.find((s) => s.id === shiftId)
    if (st) {
      setAddStart(st.startTime)
      setAddEnd(st.endTime)
      setAddBreak(st.breakMinutes)
    }
  }

  const handleAdd = () => {
    if (!addEmpId) return
    const emp = employees.find((e) => e.id === addEmpId)
    if (!emp) return
    const st = shiftTypes.find((s) => s.id === addShiftId)
    setLocal((prev) => [
      ...prev,
      {
        id: newId(),
        employeeId: emp.id,
        employeeName: emp.name,
        shiftTypeId: st?.id,
        shiftTypeName: st?.name,
        startTime: addStart,
        endTime: addEnd,
        breakMinutes: addBreak,
        note: addNote || undefined,
      },
    ])
    setAddEmpId(null)
    setAddShiftId(null)
    setAddNote('')
  }

  const remove = (id: string) => setLocal((prev) => prev.filter((e) => e.id !== id))

  return (
    <Modal
      title={`${dateISO} 편집`}
      open={open}
      onOk={() => onOk(dateISO, local)}
      onCancel={onCancel}
      okText="확인"
      cancelText="취소"
      width={480}
    >
      <Flex vertical gap={8}>
        {local.map((entry) => (
          <Flex key={entry.id} align="center" justify="space-between">
            <Text>
              {entry.employeeName} — {timeLabel(entry)}
              {entry.note && <Text type="secondary"> ({entry.note})</Text>}
            </Text>
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => remove(entry.id)}
            />
          </Flex>
        ))}

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            직원 추가
          </Text>
          <Flex vertical gap={6} style={{ marginTop: 6 }}>
            <Select
              placeholder="직원 선택"
              value={addEmpId}
              onChange={setAddEmpId}
              style={{ width: '100%' }}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
            />
            <Select
              placeholder="근무유형 선택 (선택사항)"
              value={addShiftId}
              onChange={handleShiftSelect}
              allowClear
              style={{ width: '100%' }}
              options={shiftTypes.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.startTime}-${s.endTime})`,
              }))}
            />
            <Flex gap={8}>
              <Input
                placeholder="시작"
                value={addStart}
                onChange={(e) => setAddStart(e.target.value)}
                maxLength={5}
                style={{ flex: 1 }}
              />
              <Input
                placeholder="종료"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
                maxLength={5}
                style={{ flex: 1 }}
              />
              <InputNumber
                placeholder="휴식(분)"
                value={addBreak}
                onChange={(v) => setAddBreak(v ?? 0)}
                min={0}
                style={{ width: 80 }}
              />
            </Flex>
            <Input
              placeholder="메모 (선택)"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
            />
            <Button type="dashed" onClick={handleAdd} disabled={!addEmpId} block>
              추가
            </Button>
          </Flex>
        </div>
      </Flex>
    </Modal>
  )
}

// ─── 달력 그리드 (공용 컴포넌트) ─────────────────────────────────
export function ScheduleCalendar({
  schedule,
  onCellClick,
}: {
  schedule: ScheduleV3
  onCellClick?: (dateISO: string) => void
}) {
  const { token } = theme.useToken()
  const shiftColors = useMemo(
    () => buildShiftTypeColorMap(schedule.shiftTypes, token.colorPrimary, token.colorWarning),
    [schedule.shiftTypes, token.colorPrimary, token.colorWarning]
  )
  const shiftNameToId = useMemo(
    () => new Map(schedule.shiftTypes.map((st) => [st.name, st.id])),
    [schedule.shiftTypes]
  )
  const start = new Date(schedule.startDateISO + 'T00:00:00')
  const end = new Date(schedule.endDateISO + 'T00:00:00')
  const startDOW = start.getDay()

  const allDates: (string | null)[] = Array(startDOW).fill(null)
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    allDates.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  while (allDates.length % 7 !== 0) allDates.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < allDates.length; i += 7) {
    weeks.push(allDates.slice(i, i + 7))
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {schedule.shiftTypes.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>근무유형</Text>
          <Flex wrap="wrap" gap={6} style={{ marginTop: 4 }}>
            {schedule.shiftTypes.map((st) => (
              <Tag
                key={st.id}
                color={shiftColors.get(st.id)}
                style={{ fontSize: 11, padding: '0 6px', marginInlineEnd: 0 }}
              >
                {st.name}
              </Tag>
            ))}
          </Flex>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((label, i) => (
              <th
                key={i}
                style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: i === 0 ? '#cf1322' : i === 6 ? '#096dd9' : token.colorText,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((dateISO, di) => {
                if (!dateISO) {
                  return (
                    <td
                      key={di}
                      style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorFillQuaternary,
                        height: 60,
                      }}
                    />
                  )
                }
                const dOW = new Date(dateISO + 'T00:00:00').getDay()
                const isOff = schedule.regularDaysOff.includes(dOW)
                const dayEntries = schedule.entries[dateISO] ?? []
                const day = parseInt(dateISO.slice(8, 10))

                const bg = isOff ? token.colorFillSecondary : token.colorBgContainer

                return (
                  <td
                    key={di}
                    onClick={() => onCellClick?.(dateISO)}
                    style={{
                      border: `1px solid ${token.colorBorderSecondary}`,
                      background: bg,
                      verticalAlign: 'top',
                      padding: '2px 3px',
                      cursor: onCellClick ? 'pointer' : 'default',
                      minWidth: 56,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: dOW === 0 ? '#cf1322' : dOW === 6 ? '#096dd9' : token.colorText,
                        marginBottom: 2,
                      }}
                    >
                      {day}
                    </div>
                    {isOff ? (
                      <Tag color="default" style={{ fontSize: 10, padding: '0 3px' }}>
                        휴
                      </Tag>
                    ) : (
                      dayEntries.map((entry) => {
                        const entryShiftId = entry.shiftTypeId
                          ?? (entry.shiftTypeName ? shiftNameToId.get(entry.shiftTypeName) : undefined)
                        const entryColor = entryShiftId ? shiftColors.get(entryShiftId) : undefined
                        return (
                          <Tag
                            key={entry.id}
                            color={entryColor}
                            style={{
                              fontSize: 10,
                              padding: '0 3px',
                              marginBottom: 2,
                              display: 'block',
                            }}
                          >
                            {entry.employeeName}
                          </Tag>
                        )
                      })
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MONTH_OPTIONS = [
  { value: 1, label: '1월' }, { value: 2, label: '2월' }, { value: 3, label: '3월' },
  { value: 4, label: '4월' }, { value: 5, label: '5월' }, { value: 6, label: '6월' },
  { value: 7, label: '7월' }, { value: 8, label: '8월' }, { value: 9, label: '9월' },
  { value: 10, label: '10월' }, { value: 11, label: '11월' }, { value: 12, label: '12월' },
]

// ─── 메인 페이지 ─────────────────────────────────────────────────
export function CreateSchedulePage() {
  const { isAdmin, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('settings')
  const [msgApi, contextHolder] = message.useMessage()

  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [weekPresets, setWeekPresets] = useState<WeekPreset[]>([])

  const [stModalOpen, setStModalOpen] = useState(false)
  const [editingSt, setEditingSt] = useState<ShiftType | null>(null)

  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)

  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<WeekPreset | null>(null)

  const [scheduleName, setScheduleName] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [offDays, setOffDays] = useState<number[]>([])
  const [weekPresetMap, setWeekPresetMap] = useState<Record<number, string | null>>({})
  const [applyAllPresetId, setApplyAllPresetId] = useState<string | null>(null)

  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleV3 | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 관리 탭 상태
  const [mgSchedules, setMgSchedules] = useState<ScheduleV3[]>([])
  const [mgLoading, setMgLoading] = useState(false)
  const [mgFilterYear, setMgFilterYear] = useState(new Date().getFullYear())
  const [mgFilterMonth, setMgFilterMonth] = useState<number | null>(null)
  const [mgViewingSchedule, setMgViewingSchedule] = useState<ScheduleV3 | null>(null)
  const [mgDrawerOpen, setMgDrawerOpen] = useState(false)
  const [mgEditingDate, setMgEditingDate] = useState<string | null>(null)
  const [mgSaving, setMgSaving] = useState(false)

  useEffect(() => {
    loadShiftTypes().then(setShiftTypes)
    loadEmployees().then(setEmployees)
    loadWeekPresets().then(setWeekPresets)
  }, [])

  // 비관리자(확인 완료)는 관리 탭으로 자동 이동
  // null은 admin 확인 실패/로딩 중 — 세션은 유효하므로 건드리지 않음
  useEffect(() => {
    if (isAdmin === false && !loading) setActiveTab('manage')
  }, [isAdmin, loading])

  // 관리 탭 진입 시 스케줄 로드
  useEffect(() => {
    if (activeTab === 'manage') {
      setMgLoading(true)
      loadSchedulesV3().then(setMgSchedules).finally(() => setMgLoading(false))
    }
  }, [activeTab])

  const handleStSave = async (st: ShiftType) => {
    try {
      await upsertShiftType(st)
      setShiftTypes((prev) => {
        const idx = prev.findIndex((x) => x.id === st.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = st; return next }
        return [...prev, st]
      })
      setStModalOpen(false)
    } catch { msgApi.error('저장 실패') }
  }

  const handleStDelete = async (id: string) => {
    try {
      await deleteShiftType(id)
      setShiftTypes((prev) => prev.filter((x) => x.id !== id))
    } catch { msgApi.error('삭제 실패') }
  }

  const handleEmpSave = async (emp: Employee) => {
    try {
      await upsertEmployee(emp)
      setEmployees((prev) => {
        const idx = prev.findIndex((x) => x.id === emp.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = emp; return next }
        return [...prev, emp]
      })
      setEmpModalOpen(false)
    } catch { msgApi.error('저장 실패') }
  }

  const handleEmpDelete = async (id: string) => {
    try {
      await deleteEmployee(id)
      setEmployees((prev) => prev.filter((x) => x.id !== id))
    } catch { msgApi.error('삭제 실패') }
  }

  const handlePresetSave = async (preset: WeekPreset) => {
    try {
      await upsertWeekPreset(preset)
      const updated = await loadWeekPresets()
      setWeekPresets(updated)
      setPresetModalOpen(false)
    } catch { msgApi.error('프리셋 저장 실패') }
  }

  const handlePresetDelete = async (id: string) => {
    try {
      await deleteWeekPreset(id)
      const updated = await loadWeekPresets()
      setWeekPresets(updated)
    } catch { msgApi.error('프리셋 삭제 실패') }
    setWeekPresetMap((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === id) next[Number(k)] = null
      }
      return next
    })
  }

  // ─── 관리 탭 함수 ────────────────────────────────────────────
  const handleMgView = (schedule: ScheduleV3) => {
    setMgViewingSchedule(schedule)
    setMgEditingDate(null)
    setMgDrawerOpen(true)
  }

  const handleMgDelete = async (id: string) => {
    try {
      await deleteScheduleV3(id)
      setMgSchedules((prev) => prev.filter((s) => s.id !== id))
      msgApi.success('삭제되었습니다')
    } catch {
      msgApi.error('삭제 실패')
    }
  }

  const handleMgDayEditOk = (dateISO: string, updated: ScheduleEntry[]) => {
    if (!mgViewingSchedule) return
    const newEntries = { ...mgViewingSchedule.entries }
    if (updated.length === 0) delete newEntries[dateISO]
    else newEntries[dateISO] = updated
    setMgViewingSchedule({ ...mgViewingSchedule, entries: newEntries })
    setMgEditingDate(null)
  }

  const handleMgSave = async () => {
    if (!mgViewingSchedule) return
    setMgSaving(true)
    try {
      const updated = { ...mgViewingSchedule, updatedAtISO: new Date().toISOString() }
      await upsertScheduleV3(updated)
      setMgSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      msgApi.success('저장되었습니다')
    } catch {
      msgApi.error('저장 실패')
    } finally {
      setMgSaving(false)
    }
  }

  const weeks = useMemo(() => {
    if (!dateRange) return []
    const start = dateRange[0]
    const totalDays = dateRange[1].diff(start, 'day') + 1
    const weekCount = Math.ceil(totalDays / 7)
    return Array.from({ length: weekCount }, (_, i) => {
      const wStart = start.add(i * 7, 'day')
      const wEnd = start.add(Math.min((i + 1) * 7 - 1, totalDays - 1), 'day')
      return { index: i, label: `${wStart.format('M/D')}~${wEnd.format('M/D')}` }
    })
  }, [dateRange])

  const handleGenerate = () => {
    if (!dateRange) { msgApi.warning('기간을 선택해주세요'); return }
    if (employees.length === 0) { msgApi.warning('직원을 먼저 추가해주세요'); return }
    const builtMap: Record<number, WeekPreset> = {}
    for (const [k, presetId] of Object.entries(weekPresetMap)) {
      if (presetId) {
        const p = weekPresets.find((x) => x.id === presetId)
        if (p) builtMap[Number(k)] = p
      }
    }
    const schedule = generateScheduleV3({
      employees,
      shiftTypes,
      startDateISO: dateRange[0].format('YYYY-MM-DD'),
      endDateISO: dateRange[1].format('YYYY-MM-DD'),
      regularDaysOff: offDays,
      scheduleName: scheduleName || undefined,
      weekPresetMap: Object.keys(builtMap).length > 0 ? builtMap : undefined,
    })
    const totalEntries = Object.values(schedule.entries).reduce((sum, es) => sum + es.length, 0)
    setGeneratedSchedule({ ...schedule, name: scheduleName || schedule.name })
    msgApi.success(`스케줄 생성 완료. ${totalEntries}건 자동 배정됐습니다.`)
    setActiveTab('result')
  }

  const handleDayEditOk = (dateISO: string, updated: ScheduleEntry[]) => {
    if (!generatedSchedule) return
    const newEntries = { ...generatedSchedule.entries }
    if (updated.length === 0) delete newEntries[dateISO]
    else newEntries[dateISO] = updated
    setGeneratedSchedule({ ...generatedSchedule, entries: newEntries })
    setEditingDate(null)
  }

  const handleSave = async () => {
    if (!generatedSchedule) return
    setSaving(true)
    try {
      await upsertScheduleV3({ ...generatedSchedule, updatedAtISO: new Date().toISOString() })
      msgApi.success('저장되었습니다')
      setMgLoading(true)
      loadSchedulesV3().then(setMgSchedules).finally(() => setMgLoading(false))
      setActiveTab('manage')
    } catch { msgApi.error('저장 실패') }
    finally { setSaving(false) }
  }

  const workSummaryData = useMemo(() => {
    if (!generatedSchedule) return []
    return generatedSchedule.employees.map((emp) => {
      const { totalDays, totalHours } = calcEmployeeSummary(generatedSchedule, emp.id, emp.hourlyWage)
      return { key: emp.id, name: emp.name, totalDays, totalHours }
    })
  }, [generatedSchedule])

  const workSummaryColumns = [
    { title: '직원', dataIndex: 'name', key: 'name' },
    { title: '근무일', dataIndex: 'totalDays', key: 'totalDays', render: (v: number) => `${v}일` },
    { title: '총시간', dataIndex: 'totalHours', key: 'totalHours', render: (v: number) => `${v}h` },
  ]

  const mgFilteredSchedules = useMemo(() => {
    return mgSchedules.filter((s) => {
      const year = parseInt(s.startDateISO.slice(0, 4))
      const month = parseInt(s.startDateISO.slice(5, 7))
      if (year !== mgFilterYear) return false
      if (mgFilterMonth !== null && month !== mgFilterMonth) return false
      return true
    })
  }, [mgSchedules, mgFilterYear, mgFilterMonth])

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear()
    return [cur - 1, cur, cur + 1].map((y) => ({ value: y, label: `${y}년` }))
  }, [])

  const mgWorkSummaryData = useMemo(() => {
    if (!mgViewingSchedule) return []
    return mgViewingSchedule.employees.map((emp) => {
      const { totalDays, totalHours } = calcEmployeeSummary(mgViewingSchedule, emp.id, emp.hourlyWage)
      return { key: emp.id, name: emp.name, role: emp.role, totalDays, totalHours }
    })
  }, [mgViewingSchedule])

  const mgWorkSummaryColumns = [
    { title: '직원', dataIndex: 'name', key: 'name' },
    { title: '역할', dataIndex: 'role', key: 'role', render: (v: string) => <Tag color={v === '정직원' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: '근무일', dataIndex: 'totalDays', key: 'totalDays', render: (v: number) => `${v}일` },
    { title: '총시간', dataIndex: 'totalHours', key: 'totalHours', render: (v: number) => `${v}h` },
  ]

  const mgEditingEntries = mgEditingDate
    ? (mgViewingSchedule?.entries[mgEditingDate] ?? [])
    : []

  const manageTab = (
    <Flex vertical gap={12}>
      <Flex gap={8}>
        <Select value={mgFilterYear} onChange={setMgFilterYear} options={yearOptions} style={{ width: 100 }} />
        <Select
          value={mgFilterMonth}
          onChange={setMgFilterMonth}
          options={[{ value: null, label: '전체 월' }, ...MONTH_OPTIONS]}
          style={{ width: 100 }}
        />
      </Flex>

      {mgLoading ? (
        <Text type="secondary">불러오는 중...</Text>
      ) : mgFilteredSchedules.length === 0 ? (
        <Text type="secondary">저장된 스케줄이 없습니다.</Text>
      ) : (
        mgFilteredSchedules.map((schedule) => {
          const empCount = schedule.employees.length
          const entryDays = Object.keys(schedule.entries).length
          return (
            <Flex
              key={schedule.id}
              justify="space-between"
              align="center"
              style={{ padding: '12px 14px', border: '1px solid #f0f0f0', borderRadius: 10, background: '#fafafa' }}
            >
              <Flex vertical gap={2}>
                <Text strong style={{ fontSize: 14 }}>{schedule.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {schedule.startDateISO} ~ {schedule.endDateISO}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  직원 {empCount}명 / 근무일 {entryDays}일
                </Text>
              </Flex>
              <Space>
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleMgView(schedule)}>
                  상세
                </Button>
                {isAdmin && (
                  <Popconfirm
                    title="삭제하시겠습니까?"
                    onConfirm={() => handleMgDelete(schedule.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            </Flex>
          )
        })
      )}

      <Drawer
        title={mgViewingSchedule?.name ?? '스케줄 상세'}
        open={mgDrawerOpen}
        onClose={() => { setMgDrawerOpen(false); setMgEditingDate(null) }}
        placement="bottom"
        height="90%"
        styles={{ body: { padding: '12px 8px', overflowY: 'auto' } }}
        footer={
          mgViewingSchedule ? (
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => setMgDrawerOpen(false)}>닫기</Button>
              {isAdmin && (
                <Button type="primary" onClick={handleMgSave} loading={mgSaving}>
                  저장
                </Button>
              )}
            </Flex>
          ) : null
        }
      >
        {mgViewingSchedule && (
          <Flex vertical gap={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {mgViewingSchedule.startDateISO} ~ {mgViewingSchedule.endDateISO}
              {isAdmin && <Text type="secondary" style={{ fontSize: 12 }}> · 날짜 셀을 클릭하여 편집</Text>}
            </Text>
            <ScheduleCalendar
              schedule={mgViewingSchedule}
              onCellClick={isAdmin ? setMgEditingDate : undefined}
            />
            {mgWorkSummaryData.length > 0 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>근무 요약</Text>
                <Table dataSource={mgWorkSummaryData} columns={mgWorkSummaryColumns} pagination={false} size="small" scroll={{ x: true }} />
              </div>
            )}
          </Flex>
        )}
      </Drawer>
    </Flex>
  )

  const settingsTab = (
    <Flex vertical gap={16}>
      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Text strong>근무 유형</Text>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => { setEditingSt(null); setStModalOpen(true) }}>추가</Button>
        </Flex>
        <Flex vertical gap={8}>
          {shiftTypes.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>근무유형을 추가해주세요 (예: 오픈 09:00-18:00)</Text>}
          {shiftTypes.map((st) => (
            <Flex key={st.id} justify="space-between" align="center" style={{ padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
              <Flex vertical>
                <Text strong style={{ fontSize: 13 }}>{st.name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {st.startTime}–{st.endTime} 휴식{st.breakMinutes}분 / 필요인원 {st.staffCount}명
                  {st.targetRole && st.targetRole !== '전체' && ` / ${st.targetRole}전용`}
                </Text>
              </Flex>
              <Space>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingSt(st); setStModalOpen(true) }} />
                <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleStDelete(st.id)} />
              </Space>
            </Flex>
          ))}
        </Flex>
      </div>

      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Text strong>직원</Text>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => { setEditingEmp(null); setEmpModalOpen(true) }}>추가</Button>
        </Flex>
        <Flex vertical gap={8}>
          {employees.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>직원을 추가해주세요</Text>}
          {employees.map((emp) => {
            const availableNames = emp.availableShiftIds.map((id) => shiftTypes.find((s) => s.id === id)?.name).filter(Boolean).join(', ')
            return (
              <Flex key={emp.id} justify="space-between" align="center" style={{ padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
                <Flex vertical>
                  <Flex gap={8} align="center">
                    <Text strong style={{ fontSize: 13 }}>{emp.name}</Text>
                    <Tag color={emp.role === '정직원' ? 'blue' : 'orange'} style={{ fontSize: 11 }}>{emp.role}</Tag>
                  </Flex>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {availableNames
                      ? `가능: ${availableNames}${emp.regularDaysOff.length > 0 ? ` / 휴무: ${emp.regularDaysOff.map((d) => WEEKDAY_LABELS[d]).join('')}` : ''}`
                      : '가능 근무유형 없음'}
                  </Text>
                </Flex>
                <Space>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingEmp(emp); setEmpModalOpen(true) }} />
                  <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleEmpDelete(emp.id)} />
                </Space>
              </Flex>
            )
          })}
        </Flex>
      </div>

      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Text strong>주간 프리셋</Text>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => { setEditingPreset(null); setPresetModalOpen(true) }}>추가</Button>
        </Flex>
        <Flex vertical gap={8}>
          {weekPresets.length === 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              프리셋을 추가하면 요일별로 사용할 근무유형을 미리 지정할 수 있습니다
            </Text>
          )}
          {weekPresets.map((preset) => (
            <Flex key={preset.id} justify="space-between" align="center" style={{ padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
              <Flex vertical>
                <Text strong style={{ fontSize: 13 }}>{preset.name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{presetSummary(preset, shiftTypes)}</Text>
              </Flex>
              <Space>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingPreset(preset); setPresetModalOpen(true) }} />
                <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => handlePresetDelete(preset.id)} />
              </Space>
            </Flex>
          ))}
        </Flex>
      </div>
    </Flex>
  )

  const generateTab = (
    <Flex vertical gap={16}>
      <div>
        <Text style={{ display: 'block', marginBottom: 4 }}>스케줄명</Text>
        <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="5월 스케줄" />
      </div>
      <div>
        <Text style={{ display: 'block', marginBottom: 4 }}>기간</Text>
        <RangePicker
          value={dateRange}
          onChange={(v) => {
            setDateRange(v as [Dayjs, Dayjs] | null)
            setWeekPresetMap({})
          }}
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
        />
      </div>
      <div>
        <Text style={{ display: 'block', marginBottom: 4 }}>정기휴무 요일</Text>
        <Checkbox.Group value={offDays} onChange={(v) => setOffDays(v as number[])} options={WEEKDAY_LABELS.map((label, idx) => ({ label, value: idx }))} />
      </div>
      {weekPresets.length > 0 && (
        <div>
          <Text style={{ display: 'block', marginBottom: 6 }}>주차별 프리셋</Text>
          <Flex gap={8} style={{ marginBottom: 8 }}>
            <Select
              placeholder="전체 일괄 적용할 프리셋"
              value={applyAllPresetId}
              onChange={setApplyAllPresetId}
              allowClear
              style={{ flex: 1 }}
              options={weekPresets.map((p) => ({ value: p.id, label: p.name }))}
              size="small"
            />
            <Button
              size="small"
              onClick={() => {
                const next: Record<number, string | null> = {}
                weeks.forEach((w) => { next[w.index] = applyAllPresetId })
                setWeekPresetMap(next)
              }}
              disabled={weeks.length === 0}
            >
              전체 적용
            </Button>
          </Flex>
          {weeks.length === 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>기간을 선택하면 주차별로 설정할 수 있습니다</Text>
          )}
          {weeks.map((w) => (
            <Flex key={w.index} gap={8} align="center" style={{ marginBottom: 6 }}>
              <Text style={{ width: 90, fontSize: 12, flexShrink: 0 }}>
                {w.index + 1}주차 {w.label}
              </Text>
              <Select
                placeholder="없음 (기본)"
                value={weekPresetMap[w.index] ?? null}
                onChange={(v) => setWeekPresetMap((prev) => ({ ...prev, [w.index]: v ?? null }))}
                allowClear
                style={{ flex: 1 }}
                options={weekPresets.map((p) => ({ value: p.id, label: p.name }))}
                size="small"
              />
            </Flex>
          ))}
        </div>
      )}
      <Button type="primary" onClick={handleGenerate} block>자동 생성</Button>
    </Flex>
  )

  const resultTab = generatedSchedule ? (
    <Flex vertical gap={16}>
      <Text type="secondary" style={{ fontSize: 12 }}>날짜 셀을 클릭하면 편집할 수 있습니다.</Text>
      <ScheduleCalendar schedule={generatedSchedule} onCellClick={setEditingDate} />
      {workSummaryData.length > 0 && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>근무 요약</Text>
          <Table dataSource={workSummaryData} columns={workSummaryColumns} pagination={false} size="small" />
        </div>
      )}
      <Button type="primary" onClick={handleSave} loading={saving} block>저장</Button>
    </Flex>
  ) : (
    <Text type="secondary">먼저 "생성" 탭에서 스케줄을 자동 생성해주세요.</Text>
  )

  const editingDayEntries = editingDate ? (generatedSchedule?.entries[editingDate] ?? []) : []

  // isAdmin === true: 관리자 탭 전체 표시
  // isAdmin === null: admin 확인 실패지만 세션은 유효 → 관리 탭만 표시 (비관리자와 동일)
  // isAdmin === false: 비관리자 확인 완료 → 관리 탭만 표시
  const tabItems = [
    ...(isAdmin === true
      ? [
          { key: 'settings', label: '설정', children: settingsTab },
          { key: 'generate', label: '생성', children: generateTab },
          { key: 'result', label: '결과', children: resultTab },
        ]
      : []),
    { key: 'manage', label: '관리', children: manageTab },
  ]

  return (
    <MobileShell title="스케줄">
      {contextHolder}
      <Flex vertical style={{ padding: '16px 8px', width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Flex>

      <ShiftTypeModal open={stModalOpen} initial={editingSt} onOk={handleStSave} onCancel={() => setStModalOpen(false)} />
      <EmployeeModal open={empModalOpen} initial={editingEmp} shiftTypes={shiftTypes} isAdmin={isAdmin ?? false} onOk={handleEmpSave} onCancel={() => setEmpModalOpen(false)} />
      <WeekPresetModal open={presetModalOpen} initial={editingPreset} shiftTypes={shiftTypes} onOk={handlePresetSave} onCancel={() => setPresetModalOpen(false)} />

      {editingDate && generatedSchedule && (
        <DayEditModal
          open={!!editingDate}
          dateISO={editingDate}
          entries={editingDayEntries}
          employees={generatedSchedule.employees}
          shiftTypes={generatedSchedule.shiftTypes}
          onOk={handleDayEditOk}
          onCancel={() => setEditingDate(null)}
        />
      )}

      {mgEditingDate && mgViewingSchedule && (
        <DayEditModal
          open={!!mgEditingDate}
          dateISO={mgEditingDate}
          entries={mgEditingEntries}
          employees={mgViewingSchedule.employees}
          shiftTypes={mgViewingSchedule.shiftTypes}
          onOk={handleMgDayEditOk}
          onCancel={() => setMgEditingDate(null)}
        />
      )}
    </MobileShell>
  )
}
