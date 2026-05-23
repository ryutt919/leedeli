import { CheckSquareOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, AutoComplete, Button, Card, Checkbox, Flex, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Tag, Typography, Upload, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { CsvPreviewModal } from '../components/CsvPreviewModal'
import type { CsvPreviewRow } from '../components/CsvPreviewModal'
import type { Ingredient } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { clearIngredients, deleteIngredient, loadIngredients, saveIngredients, upsertIngredient } from '../storage/ingredientsRepo'
import { downloadText } from '../utils/download'
import { newId } from '../utils/id'
import { round2, safeNumber } from '../utils/money'
import { normalizeUnitLabel, parseAmountAndUnit } from '../utils/unit'
import { downloadXlsx } from '../utils/xlsxExport'
import { parseXlsxFileToAOA } from '../utils/xlsxImport'

export function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([])
  const [listLoading, setListLoading] = useState(false)

  // 검색 + 필터
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // 다중 선택
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState<string>('')

  // 편집 모달
  const [openEdit, setOpenEdit] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form] = Form.useForm()

  // CSV/XLSX
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvPreviewRow<{ name: string; price: number; unit: number; unitLabel: string }>[]>([])

  // 파생 데이터
  const allCategories = useMemo(
    () => Array.from(new Set(items.map((x) => x.category).filter((c): c is string => !!c))).sort(),
    [items],
  )

  const filteredItems = useMemo(() => {
    let result = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((x) => x.name.toLowerCase().includes(q))
    }
    if (categoryFilter) {
      result = result.filter((x) => x.category === categoryFilter)
    }
    return result
  }, [items, search, categoryFilter])

  async function loadData() {
    setListLoading(true)
    try {
      const data = await loadIngredients()
      setItems(data)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkCategoryAssign = async () => {
    const toUpdate = items
      .filter((x) => selectedIds.has(x.id))
      .map((x) => ({ ...x, category: bulkCategory || undefined, updatedAtISO: new Date().toISOString() }))
    try {
      await saveIngredients(toUpdate)
      await loadData()
      setBulkModalOpen(false)
      setBulkCategory('')
      exitSelectionMode()
      message.success(`${toUpdate.length}개 재료에 카테고리를 지정했습니다.`)
    } catch (e) {
      message.error('일괄 지정 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ name: '', purchasePrice: 0, purchaseUnit: 1, unitLabel: 'g', category: undefined })
    setOpenEdit(true)
  }

  const openUpdate = (it: Ingredient) => {
    if (selectionMode) { toggleSelect(it.id); return }
    setEditing(it)
    form.setFieldsValue({
      name: it.name,
      purchasePrice: it.purchasePrice,
      purchaseUnit: it.purchaseUnit,
      unitLabel: it.unitLabel ?? (it.unitType === 'ea' ? '개' : 'g'),
      category: it.category ?? undefined,
    })
    setOpenEdit(true)
  }

  const onSave = async () => {
    try {
      const v = await form.validateFields()
      const name = String(v.name ?? '').trim()
      const purchasePrice = safeNumber(v.purchasePrice, 0)
      const purchaseUnit = safeNumber(v.purchaseUnit, 1)
      const unitLabel = normalizeUnitLabel(v.unitLabel) || 'g'
      const category: string | undefined = v.category || undefined
      if (!name) return
      if (purchaseUnit <= 0) { message.error('구매단위는 0보다 커야 합니다.'); return }
      const now = new Date().toISOString()
      const unitPrice = round2(purchasePrice / purchaseUnit)
      const next: Ingredient = editing
        ? { ...editing, name, purchasePrice, purchaseUnit, unitPrice, unitLabel, category, updatedAtISO: now }
        : { id: newId(), name, purchasePrice, purchaseUnit, unitPrice, unitLabel, category, updatedAtISO: now }
      await upsertIngredient(next)
      setOpenEdit(false)
      await loadData()
      message.success(editing ? '수정되었습니다.' : '추가되었습니다.')
    } catch (e) {
      if (e instanceof Error) message.error(`저장 실패: ${e.message}`)
      else console.error('onSave error', e)
    }
  }

  const onDelete = async () => {
    if (!editing) return
    try {
      await deleteIngredient(editing.id)
      setOpenEdit(false)
      await loadData()
      message.success('삭제되었습니다.')
    } catch (e) {
      message.error('삭제 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const onClear = async () => {
    try {
      await clearIngredients()
      await loadData()
      message.success('초기화되었습니다.')
    } catch (e) {
      message.error('초기화 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const onExportCsv = () => {
    const header = '이름,가격,구매단위'
    const lines = items.map((x) => `${x.name},${x.purchasePrice},${x.purchaseUnit}`)
    downloadText('ingredients.csv', '﻿' + [header, ...lines].join('\n'), 'text/csv;charset=utf-8')
  }

  const onExportXlsx = () => {
    downloadXlsx('ingredients.xlsx', 'Ingredients', items.map((x) => ({
      이름: x.name, 가격: x.purchasePrice, 구매단위: x.purchaseUnit,
      단위가격: x.unitPrice, 단위: x.unitLabel || (x.unitType === 'ea' ? '개' : 'g'),
    })))
  }

  const buildXlsxPreview = async (file: File) => {
    const aoa = await parseXlsxFileToAOA(file, { preferredSheetName: 'Ingredients' })
    const byName = new Map(items.map((x) => [x.name.toLowerCase(), x]))
    if (aoa.length < 2) {
      message.error(`엑셀 내용을 인식하지 못했습니다. (행 수=${aoa.length})`)
      return
    }
    const rows: CsvPreviewRow<{ name: string; price: number; unit: number; unitLabel: string }>[] = aoa.slice(1).map((r, idx) => {
      const row = Array.isArray(r) ? (r as unknown[]) : []
      const nameRaw = String(row[0] ?? '')
      const priceRaw = row[1]; const unitRaw = row[2]; const unitLabelRaw = row[3]
      const name = nameRaw.trim()
      const price = safeNumber(priceRaw, NaN)
      const unitParsed = parseAmountAndUnit(unitRaw)
      const unit = Number.isFinite(unitParsed.amount) ? unitParsed.amount : safeNumber(unitRaw, NaN)
      const unitLabel = normalizeUnitLabel(unitLabelRaw) || unitParsed.unitLabel || 'g'
      const errors: string[] = []
      if (!name) errors.push('이름이 비었습니다.')
      if (!Number.isFinite(price) || price < 0) errors.push('가격이 올바르지 않습니다.')
      if (!Number.isFinite(unit) || unit <= 0) errors.push('구매단위가 올바르지 않습니다.')
      const existing = name ? byName.get(name.toLowerCase()) : undefined
      const same = existing && existing.name === name && existing.purchasePrice === price && existing.purchaseUnit === unit
      const kind: CsvPreviewRow<{ name: string; price: number; unit: number }>['kind'] = errors.length ? 'invalid' : same ? 'same' : existing ? 'update' : 'create'
      return {
        key: `row_${idx + 2}_${name || 'unknown'}`, rowNo: idx + 2,
        parsed: { name, price, unit, unitLabel }, errors, kind,
        parsedLabel: (
          <Space direction="vertical" size={0}>
            <Typography.Text>{name || '(이름 없음)'}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              가격 {String(priceRaw ?? '-')} / 구매단위 {String(unitRaw ?? '-')} / 단위 {unitLabel}
            </Typography.Text>
          </Space>
        ),
        existingLabel: existing ? (
          <Space direction="vertical" size={0}>
            <Typography.Text>{existing.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              가격 {existing.purchasePrice} / 구매단위 {existing.purchaseUnit} / 단위 {existing.unitLabel ?? (existing.unitType === 'ea' ? '개' : 'g')}
            </Typography.Text>
          </Space>
        ) : undefined,
        action: kind === 'invalid' || kind === 'same' ? 'skip' : 'upsert',
      }
    })
    setCsvRows(rows)
    setCsvOpen(true)
  }

  const applyCsv = async () => {
    const byName = new Map(items.map((x) => [x.name.toLowerCase(), x]))
    const toUpsert: Ingredient[] = []
    let created = 0; let updated = 0; let skipped = 0
    for (const r of csvRows) {
      if (r.kind === 'invalid' || r.action === 'skip') { skipped++; continue }
      const nameKey = r.parsed.name.toLowerCase()
      const existing = byName.get(nameKey)
      const now = new Date().toISOString()
      const unitPrice = round2(r.parsed.price / r.parsed.unit)
      const unitLabel = normalizeUnitLabel((r.parsed as { unitLabel?: string }).unitLabel) || 'g'
      if (existing) {
        toUpsert.push({ ...existing, name: r.parsed.name, purchasePrice: r.parsed.price, purchaseUnit: r.parsed.unit, unitPrice, unitLabel, updatedAtISO: now })
        updated++
      } else {
        toUpsert.push({ id: newId(), name: r.parsed.name, purchasePrice: r.parsed.price, purchaseUnit: r.parsed.unit, unitPrice, unitLabel, updatedAtISO: now })
        created++
      }
    }
    try {
      if (toUpsert.length > 0) await saveIngredients(toUpsert)
      await loadData()
      setCsvOpen(false)
      message.success(`적용 완료: 생성 ${created}, 갱신 ${updated}, 스킵 ${skipped}`)
    } catch (e) {
      message.error('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const categorySelectOptions = allCategories.map((c) => ({ value: c, label: c }))

  return (
    <MobileShell
      title="재료 관리"
      right={
        <Space size={4}>
          <Button icon={<DownloadOutlined />} onClick={onExportXlsx}>XLSX</Button>
          <Button onClick={onExportCsv}>CSV</Button>
        </Space>
      }
    >
      {/* 액션 버튼 */}
      <Flex gap={8} wrap style={{ marginBottom: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>추가</Button>
        <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={async (file) => { await buildXlsxPreview(file); return false }}>
          <Button icon={<UploadOutlined />}>엑셀 업로드</Button>
        </Upload>
        <Button
          icon={<CheckSquareOutlined />}
          type={selectionMode ? 'primary' : 'default'}
          onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
        >
          {selectionMode ? '선택 취소' : '다중 선택'}
        </Button>
        <Popconfirm title="재료 전체를 초기화할까요?" okText="초기화" cancelText="취소" onConfirm={() => void onClear()}>
          <Button danger icon={<ReloadOutlined />}>전체 초기화</Button>
        </Popconfirm>
      </Flex>

      {/* 검색 + 카테고리 필터 */}
      <Flex gap={8} style={{ marginBottom: 8 }}>
        <Input.Search
          placeholder="이름으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ flex: 1 }}
        />
        <Select
          placeholder="카테고리"
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v ?? null)}
          allowClear
          style={{ minWidth: 120 }}
          options={[{ value: '__none__', label: '(미지정)' }, ...categorySelectOptions]}
          onClear={() => setCategoryFilter(null)}
        />
      </Flex>

      {/* 다중 선택 모드 액션 바 */}
      {selectionMode && (
        <Alert
          type="info"
          style={{ marginBottom: 8 }}
          message={
            <Flex align="center" justify="space-between">
              <Typography.Text>{selectedIds.size}개 선택됨</Typography.Text>
              <Space>
                <Button
                  size="small"
                  type="primary"
                  disabled={selectedIds.size === 0}
                  onClick={() => { setBulkCategory(''); setBulkModalOpen(true) }}
                >
                  카테고리 지정
                </Button>
                <Button size="small" onClick={() => setSelectedIds(new Set(filteredItems.map((x) => x.id)))}>
                  전체 선택
                </Button>
              </Space>
            </Flex>
          }
        />
      )}

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        업로드 엑셀 형식: 시트명 <b>Ingredients</b> / 헤더 <b>이름</b>, <b>가격</b>, <b>구매단위</b>, <b>단위</b>(선택)
      </Typography.Text>

      <Card size="small">
        <List
          loading={listLoading}
          dataSource={filteredItems}
          locale={{ emptyText: '재료가 없습니다.' }}
          renderItem={(it) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => openUpdate(it)}
              extra={
                it.category ? (
                  <Tag color="blue" style={{ margin: 0 }}>
                    {it.category === '__none__' ? '(미지정)' : it.category}
                  </Tag>
                ) : undefined
              }
            >
              {selectionMode && (
                <Checkbox
                  checked={selectedIds.has(it.id)}
                  onChange={() => toggleSelect(it.id)}
                  style={{ marginRight: 12 }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <List.Item.Meta
                title={it.name}
                description={
                  <Typography.Text type="secondary">
                    구매 {it.purchasePrice} / 구매단위 {it.purchaseUnit} {it.unitLabel ?? (it.unitType === 'ea' ? '개' : 'g')} → 단가 {it.unitPrice}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 개별 편집 모달 */}
      <Modal
        open={openEdit}
        title={editing ? '재료 수정' : '재료 추가'}
        onCancel={() => setOpenEdit(false)}
        onOk={() => void onSave()}
        okText="저장"
        footer={[
          editing && (
            <Popconfirm key="delete" title="삭제할까요?" okText="삭제" cancelText="취소" onConfirm={() => void onDelete()}>
              <Button danger icon={<DeleteOutlined />}>삭제</Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setOpenEdit(false)}>취소</Button>,
          <Button key="save" type="primary" onClick={() => void onSave()}>저장</Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="이름" rules={[{ required: true, message: '이름을 입력하세요' }]}>
            <Input placeholder="예) 우유" />
          </Form.Item>
          <Form.Item name="purchasePrice" label="구매가격" rules={[{ required: true, message: '구매가격을 입력하세요' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purchaseUnit" label="구매단위" rules={[{ required: true, message: '구매단위를 입력하세요' }]}>
            <InputNumber min={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitLabel" label="단위" initialValue="g">
            <Select
              showSearch placeholder="단위 선택"
              options={Array.from(new Set(['g', '개', '장', ...items.map((x) => x.unitLabel ?? (x.unitType === 'ea' ? '개' : 'g'))].map((x) => String(x).trim()).filter(Boolean))).map((u) => ({ value: u, label: u }))}
            />
          </Form.Item>
          <Form.Item name="category" label="카테고리 (선택)">
            <AutoComplete
              allowClear
              placeholder="카테고리 선택 또는 직접 입력"
              options={allCategories.map((c) => ({ value: c }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 일괄 카테고리 지정 모달 */}
      <Modal
        open={bulkModalOpen}
        title={`카테고리 일괄 지정 (${selectedIds.size}개)`}
        onCancel={() => setBulkModalOpen(false)}
        onOk={() => void handleBulkCategoryAssign()}
        okText="적용"
        cancelText="취소"
      >
        <Form layout="vertical">
          <Form.Item label="카테고리" extra="비워두면 카테고리가 제거됩니다.">
            <AutoComplete
              allowClear
              placeholder="카테고리 선택 또는 직접 입력"
              value={bulkCategory || undefined}
              onChange={(v) => setBulkCategory(v ?? '')}
              options={allCategories.map((c) => ({ value: c }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <CsvPreviewModal
        open={csvOpen}
        title="엑셀 미리보기 (재료)"
        rows={csvRows}
        onClose={() => setCsvOpen(false)}
        onChangeRowAction={(key, action) => setCsvRows((prev) => prev.map((r) => (r.key === key ? { ...r, action } : r)))}
        onBulkAction={(action) => setCsvRows((prev) => prev.map((r) => (r.kind === 'invalid' ? r : { ...r, action: r.kind === 'same' ? 'skip' : action })))}
        onApply={() => void applyCsv()}
      />
    </MobileShell>
  )
}
