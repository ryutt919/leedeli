import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
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
import { useEffect, useState } from 'react'
import type { Employee, LeaveGrant, LeavePolicy, VacationRecord } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { loadEmployees } from '../storage/employeesRepo'
import { addLeaveGrant, loadLeaveGrants } from '../storage/leaveGrantsRepo'
import { deleteLeavePolicy, loadLeavePolicies, upsertLeavePolicy } from '../storage/leavePoliciesRepo'
import { addVacation, deleteVacation, getVacations } from '../storage/vacationRepo'

const VACATION_TYPES = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '공가', '기타']

export function VacationTabContent() {
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [allVacations, setAllVacations] = useState<VacationRecord[]>([])
  const [leaveGrants, setLeaveGrants] = useState<LeaveGrant[]>([])
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [records, setRecords] = useState<VacationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [grantLoading, setGrantLoading] = useState(false)

  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null)
  const [policyForm] = Form.useForm()
  const policyType = Form.useWatch('type', policyForm)

  const [form] = Form.useForm()

  useEffect(() => {
    Promise.all([loadEmployees(), getVacations(), loadLeaveGrants(), loadLeavePolicies()])
      .then(([emps, vacs, grants, policies]) => {
        setEmployees(emps.sort((a, b) => a.name.localeCompare(b.name)))
        setAllVacations(vacs)
        setLeaveGrants(grants)
        setLeavePolicies(policies)
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

  // 직원별 현황 계산
  const balanceData = employees.map((emp) => {
    const usedDays = allVacations
      .filter((r) => r.employee_id === emp.id)
      .reduce((sum, r) => sum + (r.type.includes('반차') ? 0.5 : 1), 0)
    const grantedDays = leaveGrants
      .filter((g) => g.employee_id === emp.id)
      .reduce((sum, g) => sum + g.amount, 0)
    const remaining = grantedDays - usedDays
    return { key: emp.id, name: emp.name, role: emp.role, grantedDays, usedDays, remaining }
  })

  const balanceColumns = [
    { title: '직원', dataIndex: 'name', key: 'name', render: (v: string, row: typeof balanceData[0]) => (
      <Space size={4}>
        <span style={{ fontSize: 13 }}>{v}</span>
        <Tag style={{ fontSize: 10 }}>{row.role}</Tag>
      </Space>
    )},
    { title: '부여', dataIndex: 'grantedDays', key: 'granted', render: (v: number) => `${v}일` },
    { title: '사용', dataIndex: 'usedDays', key: 'used', render: (v: number) => `${v}일` },
    { title: '잔여', dataIndex: 'remaining', key: 'remaining', render: (v: number) => (
      <Typography.Text type={v < 0 ? 'danger' : v === 0 ? 'secondary' : undefined} strong={v < 0}>
        {v}일
      </Typography.Text>
    )},
  ]

  // 월차 일괄 부여
  const handleBulkGrant = async () => {
    const activeMonthly = leavePolicies.filter((p) => p.is_active && p.type === 'monthly')
    if (activeMonthly.length === 0) {
      message.warning('활성 월차 규칙이 없습니다.')
      return
    }
    const totalAmount = activeMonthly.reduce((sum, p) => sum + p.amount, 0)
    const currentMonth = dayjs().format('YYYY-MM')
    setGrantLoading(true)
    let added = 0, skipped = 0
    for (const emp of employees) {
      try {
        await addLeaveGrant(emp.id, totalAmount, currentMonth)
        added++
      } catch {
        skipped++
      }
    }
    setGrantLoading(false)
    message.success(`${added}명 부여 완료${skipped > 0 ? `, ${skipped}명은 이미 부여됨` : ''}`)
    refresh()
  }

  // 규칙 저장
  const handlePolicySave = async () => {
    try {
      const v = await policyForm.validateFields()
      await upsertLeavePolicy({
        id: editingPolicy?.id,
        label: v.label as string,
        type: v.type as 'monthly' | 'yearly' | 'interval',
        amount: v.amount as number,
        trigger_month: v.type === 'yearly' ? (v.trigger_month as number) : undefined,
        interval_days: v.type === 'interval' ? (v.interval_days as number) : undefined,
        is_active: v.is_active as boolean ?? true,
      })
      setPolicyModalOpen(false)
      setEditingPolicy(null)
      policyForm.resetFields()
      refresh()
      message.success('규칙을 저장했습니다.')
    } catch (e) {
      if (e instanceof Error) message.error(`저장 실패: ${e.message}`)
    }
  }

  const handlePolicyDelete = async (id: string) => {
    try {
      await deleteLeavePolicy(id)
      refresh()
      message.success('삭제되었습니다.')
    } catch (e) {
      message.error('삭제 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const openPolicyModal = (policy?: LeavePolicy) => {
    setEditingPolicy(policy ?? null)
    policyForm.setFieldsValue(
      policy
        ? { label: policy.label, type: policy.type, amount: policy.amount, trigger_month: policy.trigger_month, interval_days: policy.interval_days, is_active: policy.is_active }
        : { label: '', type: 'monthly', amount: 1, is_active: true }
    )
    setPolicyModalOpen(true)
  }

  return (
    <>
      {/* ── 직원별 휴가 현황 ─────────────────────────── */}
      <Card size="small" title="직원별 휴가 현황" style={{ marginBottom: 12 }}>
        <Table
          dataSource={balanceData}
          columns={balanceColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: '직원이 없습니다.' }}
        />
      </Card>

      {/* ── 휴가 부여 규칙 ───────────────────────────── */}
      <Card
        size="small"
        title="휴가 부여 규칙"
        style={{ marginBottom: 12 }}
        extra={
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openPolicyModal()}
          >
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
                  <Button type="text" size="small" onClick={() => openPolicyModal(p)}>편집</Button>
                  <Popconfirm title="삭제할까요?" okText="삭제" cancelText="취소" onConfirm={() => void handlePolicyDelete(p.id)}>
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </Flex>
            ))}
          </Flex>
        )}
        <Button
          type="primary"
          block
          style={{ marginTop: 12 }}
          loading={grantLoading}
          onClick={() => void handleBulkGrant()}
        >
          이번 달({dayjs().format('YYYY-MM')}) 활성 월차 일괄 부여
        </Button>
      </Card>

      {/* ── 직원 선택 + 개인 이력 ────────────────────── */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Select
          placeholder="직원 선택"
          value={selectedEmployeeId}
          onChange={(v) => setSelectedEmployeeId(v)}
          allowClear
          onClear={() => setSelectedEmployeeId(null)}
          style={{ width: '100%' }}
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.name} (${e.role})`,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </Card>

      {selectedEmployeeId && (
        <>
          <Card size="small" title="휴가 추가" style={{ marginBottom: 12 }}>
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
        </>
      )}

      {!selectedEmployeeId && (
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>
          위에서 직원을 선택하면 개인 휴가 이력을 확인하고 추가할 수 있습니다.
        </Typography.Text>
      )}

      {/* ── 규칙 편집 모달 ───────────────────────────── */}
      <Modal
        open={policyModalOpen}
        title={editingPolicy ? '규칙 편집' : '규칙 추가'}
        onCancel={() => { setPolicyModalOpen(false); setEditingPolicy(null); policyForm.resetFields() }}
        onOk={() => void handlePolicySave()}
        okText="저장"
      >
        <Form form={policyForm} layout="vertical">
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
          {policyType === 'yearly' && (
            <Form.Item name="trigger_month" label="부여 월" rules={[{ required: true, message: '월을 선택하세요' }]}>
              <Select
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }))}
              />
            </Form.Item>
          )}
          {policyType === 'interval' && (
            <Form.Item name="interval_days" label="부여 간격 (일)" rules={[{ required: true, message: '간격을 입력하세요' }]}>
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
