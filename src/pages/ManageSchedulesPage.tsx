import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, List, Modal, Popconfirm, Space, Typography, Form, Select, InputNumber, Input, message, Tag } from 'antd'
import { Calendar } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Shift, ExtraWork } from '../domain/types'
import { calculateTotalWorkHours } from '../domain/scheduleEngine'
import { MobileShell } from '../layouts/MobileShell'
import { deleteSchedule, loadSchedules } from '../storage/schedulesRepo'
import { getExtraWorksBySchedule, upsertExtraWork } from '../storage/extraWorkRepo'
import { exportScheduleXlsx } from '../utils/scheduleExport'
import { downloadXlsx } from '../utils/xlsxExport'
import { newId } from '../utils/id'

export function ManageSchedulesPage() {
  const nav = useNavigate()
  const [tick, setTick] = useState(0)
  const [filterYm, setFilterYm] = useState<Dayjs | null>(null)
  const [detail, setDetail] = useState<(ReturnType<typeof loadSchedules>[number]) | null>(null)
  const [extraWorkModalOpen, setExtraWorkModalOpen] = useState(false)
  const [extraWorkForm] = Form.useForm()

  const schedules = useMemo(() => {
    void tick
    return loadSchedules()
  }, [tick])
  const filtered = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!filterYm) return true
        const monthStart = filterYm.startOf('month')
        const monthEnd = filterYm.endOf('month')
        const sStart = dayjs(s.startDateISO)
        const sEnd = dayjs(s.endDateISO)
        return !sEnd.isBefore(monthStart, 'day') && !sStart.isAfter(monthEnd, 'day')
      })
      .sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO))
  }, [filterYm, schedules])

  const handleOpenExtraWorkModal = () => {
    if (!detail) return
    extraWorkForm.resetFields()
    extraWorkForm.setFieldsValue({
      dateISO: dayjs(detail.startDateISO),
      staffId: detail.staff[0]?.id,
      hours: 0,
    })
    setExtraWorkModalOpen(true)
  }

  const handleSaveExtraWork = () => {
    if (!detail) return
    extraWorkForm.validateFields().then(values => {
      const work: ExtraWork = {
        id: newId(),
        scheduleId: detail.id,
        dateISO: values.dateISO.format('YYYY-MM-DD'),
        staffId: values.staffId,
        hours: values.hours,
        note: values.note,
        createdAtISO: new Date().toISOString(),
      }
      upsertExtraWork(work)
      message.success('추가근무를 저장했습니다')
      setExtraWorkModalOpen(false)
      setTick(x => x + 1)
    })
  }

  return (
    <MobileShell
      title="스케줄 관리/조회"
      right={
        <Button
          icon={<DownloadOutlined />}
          onClick={() => {
            const rows = filtered.map((s) => ({
              시작일: s.startDateISO,
              종료일: s.endDateISO,
              인원수: s.staff.length,
              직원: s.staff.map((m) => m.name).join(', '),
              업데이트: dayjs(s.updatedAtISO).format('YYYY-MM-DD HH:mm'),
            }))
            downloadXlsx('schedules_filtered.xlsx', 'Schedules', rows)
          }}
          disabled={filtered.length === 0}
        >
          필터 엑셀
        </Button>
      }
    >
      <Card size="small" title="필터">
        <Space direction="vertical" style={{ width: '100%' }}>
          <DatePicker
            picker="month"
            value={filterYm}
            onChange={(v) => setFilterYm(v)}
            style={{ width: '100%' }}
            placeholder="연/월 선택(전체면 비움)"
          />
        </Space>
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <List
          dataSource={filtered}
          locale={{ emptyText: '저장된 스케줄이 없습니다.' }}
          renderItem={(s) => (
            <List.Item>
               <List.Item.Meta
                title={`${s.startDateISO} ~ ${s.endDateISO} (${s.staff.length}명)`}
                description={
                  <Space direction="vertical" size={2}>
                    <Typography.Text type="secondary">
                      업데이트: {dayjs(s.updatedAtISO).format('YYYY-MM-DD HH:mm')}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      인원: {s.staff.map((m) => m.name).join(', ')}
                    </Typography.Text>
                  </Space>
                }
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gridTemplateRows: 'repeat(2, 1fr)',
                  gap: 2,
                  marginBottom: 2,
                  width: 110,
                  minHeight: 54,
                }}
              >
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  style={{ padding: 0, height: 24, fontSize: 12, minWidth: 0 }}
                  onClick={() => nav(`/create?editId=${encodeURIComponent(s.id)}`)}
                >
                  수정
                </Button>
                <Button
                  key="view"
                  type="link"
                  icon={<EyeOutlined />}
                  style={{ padding: 0, height: 24, fontSize: 12, minWidth: 0 }}
                  onClick={() => setDetail(s)}
                >
                  보기
                </Button>
                <Button
                  key="exp"
                  type="link"
                  icon={<DownloadOutlined />}
                  style={{ padding: 0, height: 24, fontSize: 12, minWidth: 0 }}
                  onClick={() => exportScheduleXlsx(s)}
                >
                  다운
                </Button>
                <Popconfirm
                  key="del"
                  title="삭제할까요?"
                  okText="삭제"
                  cancelText="취소"
                  onConfirm={() => {
                    deleteSchedule(s.id)
                    setTick((x) => x + 1)
                  }}
                >
                  <Button danger type="link" icon={<DeleteOutlined />} style={{ padding: 0, height: 24, fontSize: 12, minWidth: 0 }}>
                    삭제
                  </Button>
                </Popconfirm>
              </div>
             
            </List.Item>
          )}
        />
      </Card>



      <Modal
        open={!!detail}
        title={detail ? `${detail.startDateISO} ~ ${detail.endDateISO} 스케줄` : '스케줄'}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Card 
              size="small" 
              title="인원별 통계" 
              extra={
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<PlusOutlined />}
                  onClick={handleOpenExtraWorkModal}
                >
                  추가근무
                </Button>
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '4px 8px', fontWeight: 700, textAlign: 'left' }}>이름</th>
                      <th style={{ padding: '4px 8px', fontWeight: 700 }}>근무일</th>
                      <th style={{ padding: '4px 8px', fontWeight: 700 }}>풀</th>
                      <th style={{ padding: '4px 8px', fontWeight: 700 }}>하프</th>
                      <th style={{ padding: '4px 8px', fontWeight: 700 }}>휴무</th>
                      <th style={{ padding: '4px 8px', fontWeight: 700 }}>총 시간(h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const extraWorks = getExtraWorksBySchedule(detail.id)
                      const extraHoursMap = new Map<string, number>()
                      for (const work of extraWorks) {
                        extraHoursMap.set(work.staffId, (extraHoursMap.get(work.staffId) ?? 0) + work.hours)
                      }
                      const totalHours = calculateTotalWorkHours(detail, extraHoursMap)
                      
                      return detail.stats
                        .slice()
                        .sort((a, b) => (totalHours.get(b.staffId) ?? 0) - (totalHours.get(a.staffId) ?? 0))
                        .map((st) => (
                          <tr key={st.staffId}>
                            <td style={{ padding: '4px 8px', fontWeight: 700 }}>{st.name}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>{st.workUnits}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>{st.fullDays}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>{st.halfDays}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>{st.offDays}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>
                              {totalHours.get(st.staffId) ?? 0}
                            </td>
                          </tr>
                        ))
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card size="small" title="월간 전체 달력(일자별)">
              <Calendar
                fullscreen={false}
                  className="leedeli-modal-calendar"
                  value={dayjs(detail.startDateISO)}
                validRange={[dayjs(detail.startDateISO), dayjs(detail.endDateISO)]}
                cellRender={(d: dayjs.Dayjs) => {
                  const iso = d.format('YYYY-MM-DD')
                  const assignment = detail.assignments.find((a) => a.dateISO === iso)
                  if (!assignment) return null
                    // 시프트 텍스트는 유지하되 색/배경은 제거. 저장된 요청(Requests)에 의한 하프(halfStaff)만 주황색 pill로 표시
                    const shiftLabels = { open: '오', middle: '미', close: '마' }
                    const req = (detail.requests ?? []).find((r) => r.dateISO === iso)
                    const halfPills = req?.halfStaff ?? []

                    return (
                      <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(['open', 'middle', 'close'] as Shift[]).map((shift) => {
                            const names = assignment.byShift[shift]
                              .map((x) => detail.staff.find((s) => s.id === x.staffId)?.name || '?')
                              .join(',')
                            if (!names) return null
                            return (
                              <span
                                key={shift}
                                style={{ borderRadius: 4, padding: '0 4px', display: 'inline-block', minWidth: 0 }}
                              >
                                {shiftLabels[shift]}: {names}
                              </span>
                            )
                          })}
                        </div>

                        {halfPills.length ? (
                          <div>
                            {halfPills.map((h) => {
                              const name = detail.staff.find((s) => s.id === h.staffId)?.name ?? String(h.staffId)
                              return (
                                <Tag
                                  key={String(h.staffId)}
                                  color="orange"
                                  style={{ borderRadius: 4, padding: '0 6px', display: 'inline-block', minWidth: 0, marginRight: 6 }}
                                >
                                  {name}
                                </Tag>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                }}
              />
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={extraWorkModalOpen}
        title="추가근무 입력"
        onCancel={() => setExtraWorkModalOpen(false)}
        onOk={handleSaveExtraWork}
        okText="저장"
        cancelText="취소"
      >
        <Form form={extraWorkForm} layout="vertical">
          <Form.Item
            label="날짜"
            name="dateISO"
            rules={[{ required: true, message: '날짜를 선택하세요' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              minDate={detail ? dayjs(detail.startDateISO) : undefined}
              maxDate={detail ? dayjs(detail.endDateISO) : undefined}
            />
          </Form.Item>
          <Form.Item
            label="직원"
            name="staffId"
            rules={[{ required: true, message: '직원을 선택하세요' }]}
          >
            <Select placeholder="직원 선택">
              {detail?.staff.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="추가 근무시간 (시간)"
            name="hours"
            rules={[
              { required: true, message: '시간을 입력하세요' },
              { type: 'number', min: 0, max: 24, message: '0~24 범위로 입력하세요' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={24}
              step={0.5}
              placeholder="예:2"
            />
          </Form.Item>
          <Form.Item label="메모" name="note">
            <Input style={{ width: '100%' }} placeholder="메모 (선택)" />
          </Form.Item>
        </Form>
      </Modal>
    </MobileShell>
  )
}


