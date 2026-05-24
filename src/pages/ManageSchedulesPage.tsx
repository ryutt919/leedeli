import {
  Button,
  Drawer,
  Flex,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '../layouts/MobileShell'
import { useAuth } from '../auth/AuthContext'
import type { ScheduleV3 } from '../domain/types'
import { loadSchedulesV3, deleteScheduleV3 } from '../storage/schedulesRepo'
import { calcEmployeeSummary } from '../domain/scheduleEngineV3'
import { ScheduleCalendar } from './CreateSchedulePage'

const { Text } = Typography

const MONTH_OPTIONS = [
  { value: 1, label: '1월' }, { value: 2, label: '2월' }, { value: 3, label: '3월' },
  { value: 4, label: '4월' }, { value: 5, label: '5월' }, { value: 6, label: '6월' },
  { value: 7, label: '7월' }, { value: 8, label: '8월' }, { value: 9, label: '9월' },
  { value: 10, label: '10월' }, { value: 11, label: '11월' }, { value: 12, label: '12월' },
]

export function ManageSchedulesPage() {
  const { isAdmin } = useAuth()
  const [msgApi, contextHolder] = message.useMessage()

  const [schedules, setSchedules] = useState<ScheduleV3[]>([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState<number | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewingSchedule, setViewingSchedule] = useState<ScheduleV3 | null>(null)

  useEffect(() => {
    setLoading(true)
    loadSchedulesV3()
      .then(setSchedules)
      .finally(() => setLoading(false))
  }, [])

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const year = parseInt(s.startDateISO.slice(0, 4))
      const month = parseInt(s.startDateISO.slice(5, 7))
      if (year !== filterYear) return false
      if (filterMonth !== null && month !== filterMonth) return false
      return true
    })
  }, [schedules, filterYear, filterMonth])

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear()
    return [cur - 1, cur, cur + 1].map((y) => ({ value: y, label: `${y}년` }))
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteScheduleV3(id)
      setSchedules((prev) => prev.filter((s) => s.id !== id))
      msgApi.success('삭제되었습니다')
    } catch {
      msgApi.error('삭제 실패')
    }
  }

  const handleView = (schedule: ScheduleV3) => {
    setViewingSchedule(schedule)
    setDrawerOpen(true)
  }

  const workSummaryData = useMemo(() => {
    if (!viewingSchedule) return []
    return viewingSchedule.employees.map((emp) => {
      const { totalDays, totalHours } = calcEmployeeSummary(viewingSchedule, emp.id, emp.hourlyWage)
      return { key: emp.id, name: emp.name, role: emp.role, totalDays, totalHours }
    })
  }, [viewingSchedule])

  const workSummaryColumns = [
    { title: '직원', dataIndex: 'name', key: 'name' },
    { title: '역할', dataIndex: 'role', key: 'role', render: (v: string) => <Tag color={v === '정직원' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: '근무일', dataIndex: 'totalDays', key: 'totalDays', render: (v: number) => `${v}일` },
    { title: '총시간', dataIndex: 'totalHours', key: 'totalHours', render: (v: number) => `${v}h` },
  ]

  return (
    <MobileShell title="스케줄 관리">
      {contextHolder}
      <Flex vertical style={{ padding: '16px 8px', width: '100%', maxWidth: 600, margin: '0 auto' }} gap={12}>
        {/* 필터 */}
        <Flex gap={8}>
          <Select value={filterYear} onChange={setFilterYear} options={yearOptions} style={{ width: 100 }} />
          <Select
            value={filterMonth}
            onChange={setFilterMonth}
            options={[{ value: null, label: '전체 월' }, ...MONTH_OPTIONS]}
            style={{ width: 100 }}
          />
        </Flex>

        {/* 목록 */}
        {loading ? (
          <Text type="secondary">불러오는 중...</Text>
        ) : filteredSchedules.length === 0 ? (
          <Text type="secondary">저장된 스케줄이 없습니다.</Text>
        ) : (
          filteredSchedules.map((schedule) => {
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
                  <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(schedule)}>
                    상세
                  </Button>
                  {isAdmin && (
                    <Popconfirm
                      title="삭제하시겠습니까?"
                      onConfirm={() => handleDelete(schedule.id)}
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
      </Flex>

      {/* 상세 드로어 */}
      <Drawer
        title={viewingSchedule?.name ?? '스케줄 상세'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="bottom"
        height="90%"
        styles={{ body: { padding: '12px 8px', overflowY: 'auto' } }}
      >
        {viewingSchedule && (
          <Flex vertical gap={16}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {viewingSchedule.startDateISO} ~ {viewingSchedule.endDateISO}
            </Text>
            <ScheduleCalendar schedule={viewingSchedule} />

            {workSummaryData.length > 0 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>근무 요약</Text>
                <Table dataSource={workSummaryData} columns={workSummaryColumns} pagination={false} size="small" scroll={{ x: true }} />
              </div>
            )}
          </Flex>
        )}
      </Drawer>
    </MobileShell>
  )
}
