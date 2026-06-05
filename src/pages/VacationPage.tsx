import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { Employee, VacationRecord } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { loadEmployees } from '../storage/employeesRepo'
import { addVacation, deleteVacation, getVacations } from '../storage/vacationRepo'

const VACATION_TYPES = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '공가', '기타']

export function VacationPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [records, setRecords] = useState<VacationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadEmployees()
      .then((emps) => setEmployees(emps.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => console.error('직원 로드 실패:', e))
  }, [])

  useEffect(() => {
    if (!selectedEmployeeId) { setRecords([]); return }
    setLoading(true)
    getVacations(selectedEmployeeId)
      .then(setRecords)
      .catch((e) => { console.error('휴가 이력 로드 실패:', e); setRecords([]) })
      .finally(() => setLoading(false))
  }, [selectedEmployeeId])

  const refresh = () => {
    if (!selectedEmployeeId) return
    getVacations(selectedEmployeeId).then(setRecords).catch(console.error)
  }

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

  return (
    <MobileShell title="휴가 관리">
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
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 32 }}>
          위에서 직원을 선택하면 휴가 이력을 확인하고 추가할 수 있습니다.
        </Typography.Text>
      )}
    </MobileShell>
  )
}
