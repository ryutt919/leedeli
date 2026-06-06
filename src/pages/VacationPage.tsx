import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { Employee, LeaveGrant, VacationRecord } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { loadEmployees } from '../storage/employeesRepo'
import { addLeaveGrant, deleteLeaveGrant, loadLeaveGrants } from '../storage/leaveGrantsRepo'
import { addVacation, deleteVacation, getVacations } from '../storage/vacationRepo'
import { compareEmployeesByRole } from '../utils/employees'
import { FULL_TIME_PALETTE, PART_TIME_PALETTE } from '../utils/shiftColors'

function roleTagColor(role: Employee['role']) {
  return role === '알바' ? PART_TIME_PALETTE[0] : FULL_TIME_PALETTE[0]
}

function parseBalanceInput(value: string, fallback: number): number {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatGrantPeriod(grantMonth: string, createdAt: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(grantMonth)) return grantMonth
  if (/^\d{4}-\d{2}$/.test(grantMonth)) return dayjs(grantMonth, 'YYYY-MM').format('YYYY년 M월')
  if (/^\d{4}$/.test(grantMonth)) return `${grantMonth}년`
  return dayjs(createdAt).format('YYYY-MM-DD')
}

export function VacationTabContent() {
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [allVacations, setAllVacations] = useState<VacationRecord[]>([])
  const [leaveGrants, setLeaveGrants] = useState<LeaveGrant[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [records, setRecords] = useState<VacationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantDeleteLoading, setGrantDeleteLoading] = useState(false)
  const [allResetLoading, setAllResetLoading] = useState(false)

  // 잔여 휴가 인라인 편집
  const [editingBalance, setEditingBalance] = useState<{ empId: string; value: number } | null>(null)

  const [bulkGrantType, setBulkGrantType] = useState<'월차' | '연차' | null>(null)
  const [bulkGrantForm] = Form.useForm()

  const [form] = Form.useForm()

  useEffect(() => {
    Promise.all([loadEmployees(), getVacations(), loadLeaveGrants()])
      .then(([emps, vacs, grants]) => {
        setEmployees([...emps].sort(compareEmployeesByRole))
        setAllVacations(vacs)
        setLeaveGrants(grants)
      })
      .catch((e) => console.error('데이터 로드 실패:', e))
  }, [tick])

  useEffect(() => {
    if (!selectedEmployeeId) { setRecords([]); return }
    setLoading(true)
    getVacations(selectedEmployeeId)
      .then(setRecords)
      .catch((e) => { console.error('휴가 이력 로드 실패:', e); setRecords([]) })
      .finally(() => setLoading(false))
  }, [selectedEmployeeId, tick])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const vacationTypeOptions = Array.from(new Set(['월차', '연차', ...allVacations.map((v) => v.type)]))

  const onAdd = async () => {
    try {
      const v = await form.validateFields()
      if (!selectedEmployeeId) { message.warning('직원을 선택하세요.'); return }
      const rawType = v.type as string | string[]
      const type = (Array.isArray(rawType) ? rawType[0] : rawType)?.trim()
      if (!type) { message.warning('유형을 선택하세요.'); return }
      await addVacation({
        employee_id: selectedEmployeeId,
        date: (v.date as dayjs.Dayjs).format('YYYY-MM-DD'),
        type,
        note: v.note ? String(v.note).trim() : undefined,
      })
      form.resetFields()
      refresh()
      message.success('휴가 이력을 추가했습니다.')
    } catch (e) {
      if (e instanceof Error) message.error(`저장 실패: ${e.message}`)
      else console.error(e)
    }
  }

  const onDelete = async (id: string) => {
    try {
      await deleteVacation(id)
      refresh()
      message.success('삭제되었습니다.')
    } catch (e) {
      message.error('삭제 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const onGrantDelete = async (grant: LeaveGrant) => {
    setGrantDeleteLoading(true)
    try {
      await deleteLeaveGrant(grant.id)
      refresh()
      message.success('휴가 부여 기록을 삭제했습니다.')
    } catch (e) {
      message.error('삭제 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGrantDeleteLoading(false)
    }
  }

  const onGrantReset = async () => {
    if (selectedGrantRecords.length === 0) return
    setGrantDeleteLoading(true)
    try {
      await Promise.all(selectedGrantRecords.map((g) => deleteLeaveGrant(g.id)))
      refresh()
      message.success('휴가 부여 기록을 모두 초기화했습니다.')
    } catch (e) {
      message.error('초기화 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGrantDeleteLoading(false)
    }
  }

  const totalDays = records.reduce((sum, r) => {
    if (r.type.includes('반차')) return sum + 0.5
    return sum + 1
  }, 0)

  const selectedGrantRecords = selectedEmployeeId
    ? leaveGrants
        .filter((g) => g.employee_id === selectedEmployeeId)
        .sort((a, b) => b.grant_month.localeCompare(a.grant_month) || b.created_at.localeCompare(a.created_at))
    : []
  const selectedGrantedDays = selectedGrantRecords.reduce((sum, g) => sum + g.amount, 0)

  // 직원별 현황 계산
  const balanceData = employees.map((emp) => {
    const usedDays = allVacations
      .filter((r) => r.employee_id === emp.id)
      .reduce((sum, r) => sum + (r.type.includes('반차') ? 0.5 : 1), 0)
    const grantedDays = leaveGrants
      .filter((g) => g.employee_id === emp.id)
      .reduce((sum, g) => sum + g.amount, 0)
    const remaining = Math.round((grantedDays - usedDays) * 10) / 10
    return { key: emp.id, name: emp.name, role: emp.role, grantedDays, usedDays, remaining }
  })

  // 잔여 휴가 직접 수정 (조정 grant 추가)
  const handleBalanceEdit = async (empId: string, desiredRemaining: number) => {
    const row = balanceData.find((r) => r.key === empId)
    if (!row) return
    const adjustment = Math.round((desiredRemaining - row.remaining) * 10) / 10
    if (adjustment === 0) { setEditingBalance(null); return }
    try {
      const adjKey = `adj-${dayjs().format('YYYYMMDDHHmmss')}-${empId.slice(0, 6)}`
      await addLeaveGrant(empId, adjustment, adjKey, `수동 조정 (잔여 ${row.remaining}→${desiredRemaining}일)`)
      setEditingBalance(null)
      refresh()
      message.success('잔여 휴가가 수정되었습니다.')
    } catch (e) {
      message.error('수정 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const balanceColumns = [
    {
      title: '직원',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, row: typeof balanceData[0]) => {
        const c = roleTagColor(row.role)
        return (
          <Space size={4}>
            <span style={{ fontSize: 13, fontWeight: row.key === selectedEmployeeId ? 600 : 400 }}>{v}</span>
            <Tag style={{ fontSize: 10, backgroundColor: c.bg, color: c.text, borderColor: c.bg }}>{row.role}</Tag>
          </Space>
        )
      },
    },
    { title: '부여', dataIndex: 'grantedDays', key: 'granted', render: (v: number) => `${v}일` },
    { title: '사용', dataIndex: 'usedDays', key: 'used', render: (v: number) => `${v}일` },
    {
      title: '잔여',
      dataIndex: 'remaining',
      key: 'remaining',
      render: (v: number, row: typeof balanceData[0]) => {
        if (editingBalance?.empId === row.key) {
          return (
            <InputNumber
              size="small"
              defaultValue={v}
              step={0.5}
              style={{ width: 72 }}
              autoFocus
              onBlur={(e) => void handleBalanceEdit(row.key, parseBalanceInput(e.target.value, v))}
              onPressEnter={(e) => void handleBalanceEdit(row.key, parseBalanceInput((e.target as HTMLInputElement).value, v))}
            />
          )
        }
        return (
          <Flex align="center" gap={4}>
            <Typography.Text type={v < 0 ? 'danger' : v === 0 ? 'secondary' : undefined} strong={v < 0}>
              {v}일
            </Typography.Text>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: 16, fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); setEditingBalance({ empId: row.key, value: v }) }}
            />
          </Flex>
        )
      },
    },
  ]

  // 전체 정직원에게 월차 또는 연차 일괄 부여
  const handleBulkGrantByType = async (type: '월차' | '연차') => {
    try {
      const v = await bulkGrantForm.validateFields()
      const amount = v.amount as number
      const fullTimeEmployees = employees.filter((e) => e.role === '정직원')
      if (fullTimeEmployees.length === 0) { message.warning('정직원이 없습니다.'); return }

      setGrantLoading(true)
      const today = dayjs()
      const grantMonth = type === '월차' ? today.format('YYYY-MM') : today.format('YYYY')
      let granted = 0, skipped = 0
      for (const emp of fullTimeEmployees) {
        const has = leaveGrants.some((g) => g.employee_id === emp.id && g.leave_type === type && g.grant_month === grantMonth)
        if (has) skipped++
        else { await addLeaveGrant(emp.id, amount, grantMonth, `${type} 일괄 부여`, type); granted++ }
      }
      setGrantLoading(false)
      setBulkGrantType(null)
      bulkGrantForm.resetFields()
      refresh()
      message.success(`${granted}건 부여 완료${skipped > 0 ? `, ${skipped}건 건너뜀(이미 부여됨)` : ''}`)
    } catch (e) {
      setGrantLoading(false)
      if (e instanceof Error) message.error(`부여 실패: ${e.message}`)
    }
  }

  // 전체 직원의 휴가 부여 기록 초기화
  const handleResetAllGrants = async () => {
    if (leaveGrants.length === 0) return
    setAllResetLoading(true)
    try {
      await Promise.all(leaveGrants.map((g) => deleteLeaveGrant(g.id)))
      refresh()
      message.success('전체 직원의 휴가 부여 기록을 초기화했습니다.')
    } catch (e) {
      message.error('초기화 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAllResetLoading(false)
    }
  }

  // 전체 직원의 휴가 사용 기록 초기화
  const handleResetAllUsage = async () => {
    if (allVacations.length === 0) return
    setAllResetLoading(true)
    try {
      await Promise.all(allVacations.map((v) => deleteVacation(v.id)))
      refresh()
      message.success('전체 직원의 휴가 사용 기록을 초기화했습니다.')
    } catch (e) {
      message.error('초기화 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAllResetLoading(false)
    }
  }

  const totalGrantedDays = leaveGrants.reduce((sum, g) => sum + g.amount, 0)

  return (
    <>
      {/* ── 휴가 빠른 작업 (전체 부여 / 전체 초기화) ──── */}
      <Space wrap size={8} style={{ marginBottom: 12 }}>
        <Button
          size="small"
          type="primary"
          loading={grantLoading}
          onClick={() => {
            bulkGrantForm.setFieldsValue({ amount: 1 })
            setBulkGrantType('월차')
          }}
        >
          전체 월차 부여
        </Button>
        <Button
          size="small"
          type="primary"
          loading={grantLoading}
          onClick={() => {
            bulkGrantForm.setFieldsValue({ amount: 15 })
            setBulkGrantType('연차')
          }}
        >
          전체 연차 부여
        </Button>
        <Popconfirm
          title="전체 직원의 휴가 부여 기록을 초기화할까요?"
          description={`부여 기록 ${leaveGrants.length}건(총 ${totalGrantedDays}일)이 삭제되며, 각 직원의 잔여 휴가가 그만큼 줄어듭니다.`}
          okText="초기화"
          cancelText="취소"
          onConfirm={() => void handleResetAllGrants()}
        >
          <Button size="small" danger loading={allResetLoading} disabled={leaveGrants.length === 0}>
            부여 기록 초기화
          </Button>
        </Popconfirm>
        <Popconfirm
          title="전체 직원의 휴가 사용 기록을 초기화할까요?"
          description={`사용 기록 ${allVacations.length}건이 삭제되며, 각 직원의 잔여 휴가가 그만큼 늘어납니다.`}
          okText="초기화"
          cancelText="취소"
          onConfirm={() => void handleResetAllUsage()}
        >
          <Button size="small" danger loading={allResetLoading} disabled={allVacations.length === 0}>
            사용 기록 초기화
          </Button>
        </Popconfirm>
      </Space>

      {/* ── 직원별 휴가 현황 (클릭으로 직원 선택) ──── */}
      <Card
        size="small"
        title="직원별 휴가 현황"
        style={{ marginBottom: 12 }}
        extra={<Typography.Text type="secondary" style={{ fontSize: 11 }}>행 클릭 → 이력 관리</Typography.Text>}
      >
        <Table
          dataSource={balanceData}
          columns={balanceColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: '직원이 없습니다.' }}
          onRow={(row) => ({
            onClick: () => {
              if (editingBalance) return
              setSelectedEmployeeId((prev) => prev === row.key ? null : row.key)
            },
            style: {
              cursor: 'pointer',
              background: row.key === selectedEmployeeId ? '#e6f4ff' : undefined,
            },
          })}
        />
      </Card>

      {/* ── 선택된 직원 이력 관리 ────────────────────── */}
      {selectedEmployeeId && (
        <>
          <Card size="small" title={`${selectedEmployee?.name ?? ''} 휴가 추가`} style={{ marginBottom: 12 }}>
            <Form form={form} layout="vertical">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item name="date" label="날짜" rules={[{ required: true, message: '날짜를 선택하세요' }]} style={{ marginBottom: 0 }}>
                  <DatePicker style={{ width: '100%' }} inputReadOnly />
                </Form.Item>
                <Form.Item name="type" label="유형" rules={[{ required: true, message: '유형을 선택하세요' }]} style={{ marginBottom: 0 }}>
                  <Select
                    mode="tags"
                    maxCount={1}
                    placeholder="휴가 유형 선택 또는 직접 입력"
                    options={vacationTypeOptions.map((t) => ({ value: t, label: t }))}
                  />
                </Form.Item>
                <Form.Item name="note" label="비고" style={{ marginBottom: 0 }}>
                  <Input placeholder="비고 (선택)" />
                </Form.Item>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => void onAdd()} block>
                  추가
                </Button>
              </Space>
            </Form>
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <span>{selectedEmployee?.name} 휴가 이력</span>
                <Tag color="blue">{totalDays}일 사용</Tag>
              </Space>
            }
          >
            <List
              loading={loading}
              dataSource={records}
              locale={{ emptyText: '휴가 이력이 없습니다.' }}
              renderItem={(r) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="삭제할까요?"
                      okText="삭제"
                      cancelText="취소"
                      onConfirm={() => void onDelete(r.id)}
                    >
                      <Button danger type="text" icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6}>
                        <span>{r.date}</span>
                        <Tag color="orange" style={{ fontSize: 11 }}>{r.type}</Tag>
                      </Space>
                    }
                    description={r.note ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.note}</Typography.Text>
                    ) : undefined}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <span>{selectedEmployee?.name} 휴가 부여 기록</span>
                <Tag color="green">{selectedGrantedDays}일 부여</Tag>
              </Space>
            }
            style={{ marginTop: 12 }}
            extra={
              <Popconfirm
                title="모든 휴가 부여 기록을 초기화할까요?"
                description={`초기화하면 잔여 휴가에서 ${selectedGrantedDays}일이 차감됩니다.`}
                okText="초기화"
                cancelText="취소"
                onConfirm={() => void onGrantReset()}
              >
                <Button
                  danger
                  type="text"
                  size="small"
                  disabled={selectedGrantRecords.length === 0}
                  loading={grantDeleteLoading}
                >
                  전체 초기화
                </Button>
              </Popconfirm>
            }
          >
            <List
              dataSource={selectedGrantRecords}
              locale={{ emptyText: '휴가 부여 기록이 없습니다.' }}
              renderItem={(g) => {
                const sourceLabel = g.leave_type ?? (g.rule_id ? '알 수 없는 규칙' : '수동 조정')
                return (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="delete"
                        title="휴가 부여 기록을 삭제할까요?"
                        description={`삭제하면 잔여 휴가에서 ${g.amount}일이 차감됩니다.`}
                        okText="삭제"
                        cancelText="취소"
                        onConfirm={() => void onGrantDelete(g)}
                      >
                        <Button danger type="text" icon={<DeleteOutlined />} size="small" loading={grantDeleteLoading} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={6} wrap>
                          <span>{formatGrantPeriod(g.grant_month, g.created_at)}</span>
                          <Tag color={g.amount < 0 ? 'red' : 'green'} style={{ fontSize: 11 }}>
                            {g.amount}일
                          </Tag>
                          <Tag color={g.leave_type ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                            {sourceLabel}
                          </Tag>
                        </Space>
                      }
                      description={g.note ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{g.note}</Typography.Text>
                      ) : undefined}
                    />
                  </List.Item>
                )
              }}
            />
          </Card>
        </>
      )}

      {!selectedEmployeeId && (
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>
          위 표에서 직원을 클릭하면 휴가 이력을 확인하고 추가할 수 있습니다.
        </Typography.Text>
      )}

      {/* ── 전체 정직원 일괄 부여 모달 ───────────────── */}
      <Modal
        open={bulkGrantType !== null}
        title={`전체 정직원에게 ${bulkGrantType ?? ''} 부여`}
        onCancel={() => { setBulkGrantType(null); bulkGrantForm.resetFields() }}
        onOk={() => { if (bulkGrantType) void handleBulkGrantByType(bulkGrantType) }}
        okText="부여"
        cancelText="취소"
        confirmLoading={grantLoading}
      >
        <Form form={bulkGrantForm} layout="vertical">
          <Form.Item name="amount" label={`${bulkGrantType ?? ''} 부여 일수`} rules={[{ required: true, message: '일수를 입력하세요' }]}>
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} suffix="일" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {bulkGrantType === '월차' ? '이번 달' : '올해'} 기준으로 이미 부여된 정직원은 건너뜁니다.
          </Typography.Text>
        </Form>
      </Modal>
    </>
  )
}

export function VacationPage() {
  return (
    <MobileShell title="휴가 관리">
      <VacationTabContent />
    </MobileShell>
  )
}
