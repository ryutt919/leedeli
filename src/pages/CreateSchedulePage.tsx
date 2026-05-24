import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
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
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import { MobileShell } from '../layouts/MobileShell'
import { useAuth } from '../auth/AuthContext'
import type {
  Employee,
  ScheduleEntry,
  ScheduleV3,
  ShiftType,
  WeekPreset,
  WorkPattern,
} from '../domain/types'
import { loadEmployees, upsertEmployee, deleteEmployee } from '../storage/employeesRepo'
import { loadShiftTypes, upsertShiftType, deleteShiftType } from '../storage/shiftTypesRepo'
import { upsertScheduleV3 } from '../storage/schedulesRepo'
import { generateScheduleV3, calcEmployeeSummary } from '../domain/scheduleEngineV3'
import {
  loadWeekPresets,
  upsertWeekPreset,
  deleteWeekPreset,
} from '../storage/weekPresetsRepo'

const { Text } = Typography
const { RangePicker } = DatePicker

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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
          : { name: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60, staffCount: 1 }
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
              hourlyWage: 10030,
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
          <Flex gap={8}>
            <Form.Item name="hourlyWage" label="시급(원)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="defaultBreakMinutes" label="기본휴식(분)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
        )}

        {role === '정직원' && (
          <>
            <Form.Item name="availableShiftIds" label="가능 근무유형">
              <Checkbox.Group
                options={shiftTypes.map((st) => ({ label: st.name, value: st.id }))}
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
          <Form.List name="workPatterns">
            {(fields, { add, remove }) => (
              <>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  근무 패턴 (요일별 고정 시간)
                </Text>
                {fields.map(({ key, name }) => (
                  <Flex key={key} gap={8} align="flex-start" style={{ marginTop: 8 }}>
                    <Form.Item name={[name, 'weekdays']} label="요일" style={{ flex: 2 }}>
                      <Checkbox.Group
                        options={WEEKDAY_LABELS.map((label, idx) => ({ label, value: idx }))}
                      />
                    </Form.Item>
                    <Form.Item name={[name, 'startTime']} label="시작" style={{ flex: 1 }}>
                      <Input placeholder="09:00" maxLength={5} />
                    </Form.Item>
                    <Form.Item name={[name, 'endTime']} label="종료" style={{ flex: 1 }}>
                      <Input placeholder="14:00" maxLength={5} />
                    </Form.Item>
                    <Form.Item name={[name, 'breakMinutes']} label="휴식" style={{ width: 60 }}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                      style={{ marginTop: 30 }}
                    />
                  </Flex>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      weekdays: [],
                      startTime: '09:00',
                      endTime: '14:00',
                      breakMinutes: 0,
                    } as WorkPattern)
                  }
                  style={{ marginTop: 8, width: '100%' }}
                >
                  패턴 추가
                </Button>
              </>
            )}
          </Form.List>
        )}
      </Form>
    </Modal>
  )
}

// ─── 주간 프리셋 모달 ─────────────────────────────────────────────
type DayMode = 'default' | 'specific' | 'off'
type PresetDayState = { mode: DayMode; shiftIds: string[] }

function buildDayStates(preset: WeekPreset | null): Record<number, PresetDayState> {
  const result: Record<number, PresetDayState> = {}
  for (let d = 0; d < 7; d++) {
    if (!preset || !(d in preset.dayConfig)) {
      result[d] = { mode: 'default', shiftIds: [] }
    } else {
      const cfg = preset.dayConfig[d]!
      result[d] = cfg.length === 0
        ? { mode: 'off', shiftIds: [] }
        : { mode: 'specific', shiftIds: cfg }
    }
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
  const [dayStates, setDayStates] = useState<Record<number, PresetDayState>>(buildDayStates(null))

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setNameError(false)
      setDayStates(buildDayStates(initial ?? null))
    }
  }, [open, initial])

  const setDayMode = (day: number, mode: DayMode) => {
    setDayStates((prev) => ({ ...prev, [day]: { ...prev[day], mode } }))
  }

  const setDayShifts = (day: number, shiftIds: string[]) => {
    setDayStates((prev) => ({ ...prev, [day]: { ...prev[day], shiftIds } }))
  }

  const handleOk = () => {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    const dayConfig: Partial<Record<number, string[]>> = {}
    for (let d = 0; d < 7; d++) {
      const st = dayStates[d]
      if (st.mode === 'off') dayConfig[d] = []
      else if (st.mode === 'specific') dayConfig[d] = st.shiftIds
    }
    onOk({
      id: initial?.id ?? newId(),
      name: name.trim(),
      dayConfig,
      updatedAtISO: new Date().toISOString(),
    })
  }

  return (
    <Modal
      title={initial ? '프리셋 수정' : '프리셋 추가'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="저장"
      cancelText="취소"
      width={520}
    >
      <Flex vertical gap={12}>
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

        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>요일별 근무유형</Text>
          <Flex vertical gap={6}>
            {WEEKDAY_LABELS.map((label, day) => {
              const st = dayStates[day] ?? { mode: 'default', shiftIds: [] }
              return (
                <Flex key={day} gap={8} align="flex-start" style={{ padding: '8px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                  <Text style={{ width: 20, fontWeight: 600, paddingTop: 4, color: day === 0 ? '#cf1322' : day === 6 ? '#096dd9' : undefined }}>
                    {label}
                  </Text>
                  <Flex vertical gap={6} style={{ flex: 1 }}>
                    <Radio.Group
                      value={st.mode}
                      onChange={(e) => setDayMode(day, e.target.value as DayMode)}
                      size="small"
                    >
                      <Radio.Button value="default">기본</Radio.Button>
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
  return parts.length === 0 ? '기본 (전체 적용)' : parts.join(' / ')
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
  const start = new Date(schedule.startDateISO + 'T00:00:00')
  const end = new Date(schedule.endDateISO + 'T00:00:00')
  const startDOW = start.getDay()

  const allDates: (string | null)[] = Array(startDOW).fill(null)
  const cur = new Date(start)
  while (cur <= end) {
    allDates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  while (allDates.length % 7 !== 0) allDates.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < allDates.length; i += 7) {
    weeks.push(allDates.slice(i, i + 7))
  }

  return (
    <div style={{ overflowX: 'auto' }}>
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
                const isWeekend = dOW === 0 || dOW === 6
                const dayEntries = schedule.entries[dateISO] ?? []
                const day = parseInt(dateISO.slice(8, 10))

                let bg = token.colorBgContainer
                if (isOff) bg = token.colorFillSecondary
                else if (isWeekend) bg = token.colorFillTertiary

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
                      dayEntries.map((entry) => (
                        <Tag
                          key={entry.id}
                          color="blue"
                          style={{
                            fontSize: 10,
                            padding: '0 3px',
                            marginBottom: 2,
                            display: 'block',
                          }}
                        >
                          {entry.employeeName}
                          {entry.shiftTypeName
                            ? ` ${entry.shiftTypeName}`
                            : ` ${entry.startTime}`}
                        </Tag>
                      ))
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

// ─── 메인 페이지 ─────────────────────────────────────────────────
export function CreateSchedulePage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
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
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)

  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleV3 | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadShiftTypes().then(setShiftTypes)
    loadEmployees().then(setEmployees)
    setWeekPresets(loadWeekPresets())
  }, [])

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

  const handlePresetSave = (preset: WeekPreset) => {
    upsertWeekPreset(preset)
    setWeekPresets(loadWeekPresets())
    setPresetModalOpen(false)
  }

  const handlePresetDelete = (id: string) => {
    deleteWeekPreset(id)
    setWeekPresets(loadWeekPresets())
    if (selectedPresetId === id) setSelectedPresetId(null)
  }

  const handleGenerate = () => {
    if (!dateRange) { msgApi.warning('기간을 선택해주세요'); return }
    if (employees.length === 0) { msgApi.warning('직원을 먼저 추가해주세요'); return }
    const preset = selectedPresetId ? weekPresets.find((p) => p.id === selectedPresetId) : undefined
    const schedule = generateScheduleV3({
      employees,
      shiftTypes,
      startDateISO: dateRange[0].format('YYYY-MM-DD'),
      endDateISO: dateRange[1].format('YYYY-MM-DD'),
      regularDaysOff: offDays,
      scheduleName: scheduleName || undefined,
      weekPreset: preset,
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
      setTimeout(() => navigate('/manage'), 800)
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
                <Text type="secondary" style={{ fontSize: 11 }}>{st.startTime}–{st.endTime} 휴식{st.breakMinutes}분 / 필요인원 {st.staffCount}명</Text>
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
            const patternDesc = emp.workPatterns.map((p) => `${p.weekdays.map((d) => WEEKDAY_LABELS[d]).join('')} ${p.startTime}-${p.endTime}`).join(' / ')
            return (
              <Flex key={emp.id} justify="space-between" align="center" style={{ padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
                <Flex vertical>
                  <Flex gap={8} align="center">
                    <Text strong style={{ fontSize: 13 }}>{emp.name}</Text>
                    <Tag color={emp.role === '정직원' ? 'blue' : 'orange'} style={{ fontSize: 11 }}>{emp.role}</Tag>
                    {isAdmin && <Text type="secondary" style={{ fontSize: 11 }}>시급 {emp.hourlyWage.toLocaleString()}원</Text>}
                  </Flex>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {emp.role === '정직원'
                      ? availableNames ? `가능: ${availableNames}${emp.regularDaysOff.length > 0 ? ` / 휴무: ${emp.regularDaysOff.map((d) => WEEKDAY_LABELS[d]).join('')}` : ''}` : '가능 근무유형 없음'
                      : patternDesc || '패턴 없음'}
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
        <RangePicker value={dateRange} onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)} style={{ width: '100%' }} format="YYYY-MM-DD" />
      </div>
      <div>
        <Text style={{ display: 'block', marginBottom: 4 }}>정기휴무 요일</Text>
        <Checkbox.Group value={offDays} onChange={(v) => setOffDays(v as number[])} options={WEEKDAY_LABELS.map((label, idx) => ({ label, value: idx }))} />
      </div>
      <div>
        <Text style={{ display: 'block', marginBottom: 4 }}>주간 프리셋 (선택사항)</Text>
        <Select
          placeholder="없음 — 모든 근무유형 기본 적용"
          value={selectedPresetId}
          onChange={setSelectedPresetId}
          allowClear
          style={{ width: '100%' }}
          options={weekPresets.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
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

  return (
    <MobileShell title="스케줄 생성">
      {contextHolder}
      <Flex vertical style={{ padding: '16px 8px', width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'settings', label: '설정', children: settingsTab },
            { key: 'generate', label: '생성', children: generateTab },
            { key: 'result', label: '결과', children: resultTab },
          ]}
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
    </MobileShell>
  )
}
