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
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import type { Employee, LeaveGrant, LeavePolicy, VacationRecord } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { loadEmployees } from '../storage/employeesRepo'
import { addLeaveGrant, loadLeaveGrants } from '../storage/leaveGrantsRepo'
import { deleteLeavePolicy, loadLeavePolicies, upsertLeavePolicy } from '../storage/leavePoliciesRepo'
import { addVacation, deleteVacation, getVacations } from '../storage/vacationRepo'
import { FULL_TIME_PALETTE, PART_TIME_PALETTE } from '../utils/shiftColors'

const VACATION_TYPES = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '공가', '기타']

function sortEmployeesForVacation(a: Employee, b: Employee): number {
  if (a.role !== b.role) return a.role === '정직원' ? -1 : 1
  return a.name.localeCompare(b.name)
}

function roleTagColor(role: Employee['role']) {
  return role === '알바' ? PART_TIME_PALETTE[0] : FULL_TIME_PALETTE[0]
}

function policyTypeLabel(policy?: LeavePolicy): string {
  if (!policy) return '조정'
  if (policy.type === 'monthly') return '월마다'
  if (policy.type === 'yearly') return '년마다'
  return `${policy.interval_days ?? '?'}일마다`
}

export function VacationTabContent() {
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)
  const autoGranted = useRef(false)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [allVacations, setAllVacations] = useState<VacationRecord[]>([])
  const [leaveGrants, setLeaveGrants] = useState<LeaveGrant[]>([])
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [records, setRecords] = useState<VacationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [grantLoading, setGrantLoading] = useState(false)

  // 잔여 휴가 인라인 편집
  const [editingBalance, setEditingBalance] = useState<{ empId: string; value: number } | null>(null)

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<LeavePolicy | null>(null)
  const [ruleForm] = Form.useForm()
  const ruleType = Form.useWatch('type', ruleForm)

  const [form] = Form.useForm()

  useEffect(() => {
    Promise.all([loadEmployees(), getVacations(), loadLeaveGrants(), loadLeavePolicies()])
      .then(([emps, vacs, grants, policies]) => {
        setEmployees([...emps].sort(sortEmployeesForVacation))
        setAllVacations(vacs)
        setLeaveGrants(grants)
        setLeavePolicies(policies)
      })
      .catch((e) => console.error('데이터 로드 실패:', e))
  }, [tick])

  // 자동 휴가 부여 (모든 활성 규칙 타입: monthly / yearly / interval)
  useEffect(() => {
    if (autoGranted.current) return
    if (employees.length === 0 || leavePolicies.length === 0) return

    const activePolicies = leavePolicies.filter((p) => p.is_active)
    if (activePolicies.length === 0) { autoGranted.current = true; return }

    autoGranted.current = true
    const today = dayjs()
    const pending: Promise<unknown>[] = []

    for (const p of activePolicies) {
      for (const emp of employees) {
        if (p.type === 'monthly') {
          const grantMonth = today.format('YYYY-MM')
          const has = leaveGrants.some(
            (g) => g.employee_id === emp.id && g.grant_month === grantMonth && g.rule_id === p.id
          )
          if (!has) pending.push(addLeaveGrant(emp.id, p.amount, grantMonth, undefined, p.id).catch(() => {}))

        } else if (p.type === 'yearly') {
          if (today.month() + 1 !== p.trigger_month) continue
          const grantMonth = today.format('YYYY')
          const has = leaveGrants.some(
            (g) => g.employee_id === emp.id && g.grant_month === grantMonth && g.rule_id === p.id
          )
          if (!has) pending.push(addLeaveGrant(emp.id, p.amount, grantMonth, undefined, p.id).catch(() => {}))

        } else if (p.type === 'interval' && p.interval_days) {
          const empGrants = leaveGrants
            .filter((g) => g.employee_id === emp.id && g.rule_id === p.id)
            .sort((a, b) => a.grant_month.localeCompare(b.grant_month))

          if (empGrants.length === 0) {
            pending.push(addLeaveGrant(emp.id, p.amount, today.format('YYYY-MM-DD'), undefined, p.id).catch(() => {}))
          } else {
            const startDate = dayjs(empGrants[0].grant_month)
            const expected = Math.floor(today.diff(startDate, 'day') / p.interval_days) + 1
            for (let i = empGrants.length; i < expected; i++) {
              const grantDate = startDate.add(i * p.interval_days, 'day').format('YYYY-MM-DD')
              pending.push(addLeaveGrant(emp.id, p.amount, grantDate, undefined, p.id).catch(() => {}))
            }
          }
        }
      }
    }

    if (pending.length > 0) {
      Promise.all(pending).then(() => {
        message.success('활성 규칙에 따라 휴가가 자동으로 부여되었습니다.')
        refresh()
      })
    }
  }, [employees, leavePolicies, leaveGrants])

  useEffect(() => {
    if (!selectedEmployeeId) { setRecords([]); return }
    setLoading(true)
    getVacations(selectedEmployeeId)
      .then(setRecords)
      .catch((e) => { console.error('휴가 이력 로드 실패:', e); setRecords([]) })
      .finally(() => setLoading(false))
  }, [selectedEmployeeId, tick])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const onAdd = async () => {
    try {
      const v = await form.validateFields()
      if (!selectedEmployeeId) { message.warning('직원을 선택하세요.'); return }
      await addVacation({
        employee_id: selectedEmployeeId,
        date: (v.date as dayjs.Dayjs).format('YYYY-MM-DD'),
        type: v.type as string,
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

  const totalDays = records.reduce((sum, r) => {
    if (r.type.includes('반차')) return sum + 0.5
    return sum + 1
  }, 0)

  const policyById = new Map(leavePolicies.map((p) => [p.id, p]))
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
              onBlur={(e) => void handleBalanceEdit(row.key, parseFloat(e.target.value) || v)}
              onPressEnter={(e) => void handleBalanceEdit(row.key, parseFloat((e.target as HTMLInputElement).value) || v)}
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

  // 자동 부여 재실행 (누락된 경우 수동으로 강제 적용)
  const handleBulkGrant = async () => {
    const activePolicies = leavePolicies.filter((p) => p.is_active)
    if (activePolicies.length === 0) { message.warning('활성 규칙이 없습니다.'); return }
    setGrantLoading(true)
    autoGranted.current = false  // 재실행 허용
    const today = dayjs()
    let added = 0, skipped = 0
    for (const p of activePolicies) {
      for (const emp of employees) {
        let grantMonth: string
        if (p.type === 'monthly') {
          grantMonth = today.format('YYYY-MM')
        } else if (p.type === 'yearly') {
          if (today.month() + 1 !== p.trigger_month) continue
          grantMonth = today.format('YYYY')
        } else {
          continue  // interval은 useEffect 자동 처리
        }
        const has = leaveGrants.some(
          (g) => g.employee_id === emp.id && g.grant_month === grantMonth && g.rule_id === p.id
        )
        if (has) { skipped++; continue }
        try { await addLeaveGrant(emp.id, p.amount, grantMonth, undefined, p.id); added++ }
        catch { skipped++ }
      }
    }
    setGrantLoading(false)
    refresh()
    if (added > 0) message.success(`${added}건 부여 완료${skipped > 0 ? `, ${skipped}건 건너뜀` : ''}`)
    else message.info('새로 부여할 항목이 없습니다.')
  }

  // 규칙 저장
  const handleRuleSave = async () => {
    try {
      const v = await ruleForm.validateFields()
      await upsertLeavePolicy({
        id: editingRule?.id,
        label: v.label as string,
        type: v.type as 'monthly' | 'yearly' | 'interval',
        amount: v.amount as number,
        trigger_month: v.type === 'yearly' ? (v.trigger_month as number) : undefined,
        interval_days: v.type === 'interval' ? (v.interval_days as number) : undefined,
        is_active: (v.is_active as boolean) ?? true,
      })
      setRuleModalOpen(false)
      setEditingRule(null)
      ruleForm.resetFields()
      refresh()
      message.success('규칙을 저장했습니다.')
    } catch (e) {
      if (e instanceof Error) message.error(`저장 실패: ${e.message}`)
    }
  }

  const handleRuleDelete = async (id: string) => {
    try {
      await deleteLeavePolicy(id)
      refresh()
      message.success('삭제되었습니다.')
    } catch (e) {
      message.error('삭제 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const openRuleModal = (rule?: LeavePolicy) => {
    setEditingRule(rule ?? null)
    ruleForm.setFieldsValue(
      rule
        ? { label: rule.label, type: rule.type, amount: rule.amount, trigger_month: rule.trigger_month, interval_days: rule.interval_days, is_active: rule.is_active }
        : { label: '', type: 'monthly', amount: 1, is_active: true }
    )
    setRuleModalOpen(true)
  }

  return (
    <>
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

      {/* ── 휴가 부여 규칙 ───────────────────────────── */}
      <Card
        size="small"
        title="휴가 부여 규칙"
        style={{ marginBottom: 12 }}
        extra={
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => openRuleModal()}>
            규칙 추가
          </Button>
        }
      >
        {leavePolicies.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            규칙이 없습니다. 추가 버튼으로 월차·연차 규칙을 만드세요.
          </Typography.Text>
        ) : (
          <Flex vertical gap={6}>
            {leavePolicies.map((p) => (
              <Flex key={p.id} justify="space-between" align="center">
                <Space size={6}>
                  <Tag color={p.is_active ? 'blue' : 'default'}>
                    {p.type === 'monthly' ? '월마다' : p.type === 'yearly' ? '년마다' : `${p.interval_days ?? '?'}일마다`}
                  </Tag>
                  <Typography.Text style={{ fontSize: 13 }}>{p.label}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {p.amount}일
                    {p.type === 'yearly' && p.trigger_month != null ? ` / ${p.trigger_month}월` : ''}
                  </Typography.Text>
                </Space>
                <Space size={4}>
                  <Button type="text" size="small" onClick={() => openRuleModal(p)}>편집</Button>
                  <Popconfirm title="삭제할까요?" okText="삭제" cancelText="취소" onConfirm={() => void handleRuleDelete(p.id)}>
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </Flex>
            ))}
          </Flex>
        )}
        <Button
          type="default"
          block
          style={{ marginTop: 12 }}
          loading={grantLoading}
          onClick={() => void handleBulkGrant()}
        >
          자동 부여 재실행 (누락 보완)
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, textAlign: 'center' }}>
          월마다·년마다·n일마다 규칙은 앱 접속 시 자동으로 부여됩니다.
        </Typography.Text>
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
                    placeholder="휴가 유형 선택"
                    options={VACATION_TYPES.map((t) => ({ value: t, label: t }))}
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
          >
            <List
              dataSource={selectedGrantRecords}
              locale={{ emptyText: '휴가 부여 기록이 없습니다.' }}
              renderItem={(g) => {
                const policy = g.rule_id ? policyById.get(g.rule_id) : undefined
                const sourceLabel = policy?.label ?? (g.rule_id ? '알 수 없는 규칙' : '수동 조정')
                return (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space size={6} wrap>
                          <span>{g.grant_month}</span>
                          <Tag color={g.amount < 0 ? 'red' : 'green'} style={{ fontSize: 11 }}>
                            {g.amount}일
                          </Tag>
                          <Tag color={g.rule_id ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                            {sourceLabel}
                          </Tag>
                          <Tag color="default" style={{ fontSize: 11 }}>
                            {policyTypeLabel(policy)}
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

      {/* ── 규칙 편집 모달 ───────────────────────────── */}
      <Modal
        open={ruleModalOpen}
        title={editingRule ? '규칙 편집' : '규칙 추가'}
        onCancel={() => { setRuleModalOpen(false); setEditingRule(null); ruleForm.resetFields() }}
        onOk={() => void handleRuleSave()}
        okText="저장"
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="label" label="규칙 이름" rules={[{ required: true, message: '이름을 입력하세요' }]}>
            <Input placeholder="예) 월차" />
          </Form.Item>
          <Form.Item name="type" label="유형" rules={[{ required: true }]}>
            <Select options={[
              { value: 'monthly', label: '월마다' },
              { value: 'yearly', label: '년마다' },
              { value: 'interval', label: 'n일마다 (사용자 지정)' },
            ]} />
          </Form.Item>
          <Form.Item name="amount" label="부여 일수" rules={[{ required: true }]}>
            <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          {ruleType === 'yearly' && (
            <Form.Item name="trigger_month" label="부여 월" rules={[{ required: true, message: '월을 선택하세요' }]}>
              <Select
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }))}
              />
            </Form.Item>
          )}
          {ruleType === 'interval' && (
            <Form.Item name="interval_days" label="부여 간격" rules={[{ required: true, message: '간격을 입력하세요' }]}>
              <InputNumber min={1} style={{ width: '100%' }} addonAfter="일마다" />
            </Form.Item>
          )}
          <Form.Item name="is_active" label="활성" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
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
