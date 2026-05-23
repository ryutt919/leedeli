import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  AutoComplete,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { Ingredient, MenuItem, MenuIngredientItem, MenuPrepItem, Prep } from '../domain/types'
import { MobileShell } from '../layouts/MobileShell'
import { loadIngredients } from '../storage/ingredientsRepo'
import { loadPreps } from '../storage/prepsRepo'
import { deleteMenuItem, loadMenuItems, upsertMenuItem } from '../storage/menuItemsRepo'
import { newId } from '../utils/id'
import { round2, safeNumber } from '../utils/money'

export function MenuPage() {
  const [tick, setTick] = useState(0)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [preps, setPreps] = useState<Prep[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  useEffect(() => {
    loadIngredients().then((items) => setIngredients(items.sort((a, b) => a.name.localeCompare(b.name))))
    loadPreps().then((items) => setPreps(items.sort((a, b) => a.name.localeCompare(b.name))))
    loadMenuItems().then((items) => setMenuItems(items.sort((a, b) => a.name.localeCompare(b.name))))
  }, [tick])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [openEdit, setOpenEdit] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form] = Form.useForm()

  const refresh = () => setTick((x) => x + 1)

  const ingredientById = useMemo(() => new Map(ingredients.map((x) => [x.id, x])), [ingredients])
  const prepById = useMemo(() => new Map(preps.map((x) => [x.id, x])), [preps])

  // 메뉴 카테고리는 menuItems에서만 파생 (독립)
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    menuItems.forEach((m) => { if (m.category) cats.add(m.category) })
    return [...cats].sort()
  }, [menuItems])

  const filteredMenuItems = useMemo(() => {
    let list = menuItems
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    if (categoryFilter === '__none__') {
      list = list.filter((m) => !m.category)
    } else if (categoryFilter) {
      list = list.filter((m) => m.category === categoryFilter)
    }
    return list
  }, [menuItems, search, categoryFilter])

  const unitLabelOf = (ingredientId: string) => {
    const ing = ingredientById.get(ingredientId)
    return ing?.unitLabel ?? (ing?.unitType === 'ea' ? '개' : 'g')
  }

  const prepUnitLabelOf = (prepId: string) => {
    const prep = prepById.get(prepId)
    return prep?.yieldUnit ?? 'g'
  }

  const calcPrepTotalCost = (prep: Prep): number => {
    return prep.items.reduce((acc, i) => {
      const ing = ingredientById.get(i.ingredientId)
      return acc + (ing?.unitPrice ?? 0) * i.amount
    }, 0)
  }

  const calcMenuCost = (item: MenuItem): number => {
    let sum = 0
    for (const it of item.ingredientItems) {
      const ing = ingredientById.get(it.ingredientId)
      sum += (ing?.unitPrice ?? 0) * it.amount
    }
    for (const pt of item.prepItems) {
      const prep = prepById.get(pt.prepId)
      if (!prep) continue
      const prepTotalCost = calcPrepTotalCost(prep)
      const prepUnitPrice = (prep.yieldAmount ?? 0) > 0 ? prepTotalCost / prep.yieldAmount! : 0
      sum += prepUnitPrice * pt.amount
    }
    return round2(sum)
  }

  const calcMenuCostFromForm = (
    ingItems: MenuIngredientItem[],
    prepItems: MenuPrepItem[],
  ): number => {
    let sum = 0
    for (const it of ingItems) {
      if (!it?.ingredientId || !it.amount) continue
      const ing = ingredientById.get(it.ingredientId)
      sum += (ing?.unitPrice ?? 0) * safeNumber(it.amount, 0)
    }
    for (const pt of prepItems) {
      if (!pt?.prepId || !pt.amount) continue
      const prep = prepById.get(pt.prepId)
      if (!prep) continue
      const prepTotalCost = calcPrepTotalCost(prep)
      const prepUnitPrice = (prep.yieldAmount ?? 0) > 0 ? prepTotalCost / prep.yieldAmount! : 0
      sum += prepUnitPrice * safeNumber(pt.amount, 0)
    }
    return round2(sum)
  }

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ name: '', category: undefined, ingredientItems: [], prepItems: [] })
    setOpenEdit(true)
  }

  const openUpdate = (m: MenuItem) => {
    setEditing(m)
    form.setFieldsValue({
      name: m.name,
      category: m.category ?? undefined,
      ingredientItems: m.ingredientItems.map((x) => ({ ...x })),
      prepItems: m.prepItems.map((x) => ({ ...x })),
    })
    setOpenEdit(true)
  }

  const onSave = async () => {
    try {
      const v = await form.validateFields()
      const name = String(v.name ?? '').trim()
      const category = v.category ? String(v.category).trim() : undefined
      const rawIngItems = (v.ingredientItems ?? []) as MenuIngredientItem[]
      const rawPrepItems = (v.prepItems ?? []) as MenuPrepItem[]
      const now = new Date().toISOString()

      const ingredientItems = rawIngItems
        .filter((x) => x && x.ingredientId && x.amount > 0)
        .map((x) => ({
          ingredientId: x.ingredientId,
          ingredientName: x.ingredientName || (ingredientById.get(x.ingredientId)?.name ?? ''),
          amount: safeNumber(x.amount, 0),
        }))

      const prepItems = rawPrepItems
        .filter((x) => x && x.prepId && x.amount > 0)
        .map((x) => {
          const prep = prepById.get(x.prepId)
          return {
            prepId: x.prepId,
            prepName: x.prepName || (prep?.name ?? ''),
            amount: safeNumber(x.amount, 0),
            unitLabel: x.unitLabel || (prep?.yieldUnit ?? 'g'),
          }
        })

      const next: MenuItem = editing
        ? { ...editing, name, category, ingredientItems, prepItems, updatedAtISO: now }
        : { id: newId(), name, category, ingredientItems, prepItems, updatedAtISO: now }

      await upsertMenuItem(next)
      setOpenEdit(false)
      refresh()
      message.success(editing ? '수정되었습니다.' : '추가되었습니다.')
    } catch (e) {
      if (e instanceof Error) {
        message.error(`저장 실패: ${e.message}`)
      } else {
        console.error('onSave error', e)
      }
    }
  }

  return (
    <MobileShell title="메뉴 관리">
      <Flex gap={8} wrap style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          추가
        </Button>
      </Flex>

      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="메뉴 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setSearch(v)}
            allowClear
            style={{ flex: 1, minWidth: 160 }}
          />
          <Select
            placeholder="카테고리 필터"
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v ?? null)}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: '__none__', label: '(미분류)' },
              ...allCategories.map((c) => ({ value: c, label: c })),
            ]}
          />
        </Flex>
        <List
          dataSource={filteredMenuItems}
          locale={{ emptyText: '메뉴가 없습니다. "추가"를 눌러 메뉴를 등록하세요.' }}
          renderItem={(m) => {
            const cost = Math.round(calcMenuCost(m))
            return (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => openUpdate(m)}>
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      <span>{m.name}</span>
                      {m.category && <Tag color="blue" style={{ fontSize: 11 }}>{m.category}</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      {m.ingredientItems.length > 0 && (
                        <Typography.Text type="secondary" ellipsis={{ tooltip: true }} style={{ display: 'block' }}>
                          재료: {m.ingredientItems.map((it) => `${it.ingredientName} ${it.amount}${unitLabelOf(it.ingredientId)}`).join(', ')}
                        </Typography.Text>
                      )}
                      {m.prepItems.length > 0 && (
                        <Typography.Text type="secondary" ellipsis={{ tooltip: true }} style={{ display: 'block' }}>
                          프렙: {m.prepItems.map((pt) => `${pt.prepName} ${pt.amount}${pt.unitLabel}`).join(', ')}
                        </Typography.Text>
                      )}
                      <Typography.Text type="secondary">
                        단가 {cost}원
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Card>

      <Modal
        open={openEdit}
        title={editing ? '메뉴 수정' : '메뉴 추가'}
        onCancel={() => setOpenEdit(false)}
        onOk={onSave}
        okText="저장"
        width={720}
        footer={[
          editing && (
            <Popconfirm
              key="delete"
              title="삭제할까요?"
              okText="삭제"
              cancelText="취소"
              onConfirm={async () => {
                await deleteMenuItem(editing.id)
                setOpenEdit(false)
                refresh()
              }}
            >
              <Button danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setOpenEdit(false)}>
            취소
          </Button>,
          <Button key="save" type="primary" onClick={onSave}>
            저장
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" initialValues={{ ingredientItems: [], prepItems: [] }}>
          {/* 라이브 비용 미리보기 */}
          <Form.Item shouldUpdate noStyle>
            {() => {
              const ingItems = (form.getFieldValue('ingredientItems') ?? []) as MenuIngredientItem[]
              const prepItems = (form.getFieldValue('prepItems') ?? []) as MenuPrepItem[]
              const cost = Math.round(calcMenuCostFromForm(ingItems, prepItems))
              return (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  예상 단가: {cost}원
                </Typography.Text>
              )
            }}
          </Form.Item>

          <Form.Item name="name" label="메뉴 이름" rules={[{ required: true, message: '이름을 입력하세요' }]}>
            <Input placeholder="예) 클럽 샌드위치" />
          </Form.Item>

          <Form.Item name="category" label="카테고리">
            <AutoComplete
              allowClear
              placeholder="카테고리 선택 또는 직접 입력 (예: 샌드위치, 스프, 샐러드)"
              options={allCategories.map((c) => ({ value: c }))}
            />
          </Form.Item>

          {/* 직접 재료 섹션 */}
          <Form.List name="ingredientItems">
            {(fields, { add, remove }) => (
              <Card size="small" title="직접 재료" style={{ marginBottom: 12 }} extra={<Button size="small" onClick={() => add()}>추가</Button>}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {fields.length === 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>재료를 추가하세요.</Typography.Text>
                  )}
                  {fields.map((f) => (
                    <Flex key={f.key} gap={8} align="start">
                      <Form.Item
                        {...f}
                        name={[f.name, 'ingredientId']}
                        label="재료"
                        rules={[{ required: true, message: '재료 선택' }]}
                        style={{ flex: 1, marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder="재료 선택"
                          optionFilterProp="label"
                          options={ingredients.map((i) => ({ value: i.id, label: i.name }))}
                          onChange={(id) => {
                            const ing = ingredientById.get(id)
                            form.setFieldValue(['ingredientItems', f.name, 'ingredientName'], ing?.name ?? '')
                          }}
                        />
                      </Form.Item>
                      <Form.Item label="투입량" style={{ width: 180, marginBottom: 0 }}>
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item {...f} name={[f.name, 'amount']} rules={[{ required: true, message: '투입량' }]} noStyle>
                            <InputNumber min={0} style={{ width: 120 }} />
                          </Form.Item>
                          <Form.Item
                            shouldUpdate={(prev, cur) =>
                              (prev.ingredientItems?.[f.name]?.ingredientId ?? '') !==
                              (cur.ingredientItems?.[f.name]?.ingredientId ?? '')
                            }
                            noStyle
                          >
                            {() => {
                              const id = String(form.getFieldValue(['ingredientItems', f.name, 'ingredientId']) ?? '')
                              return <Button disabled style={{ width: 60 }}>{id ? unitLabelOf(id) : '-'}</Button>
                            }}
                          </Form.Item>
                        </Space.Compact>
                      </Form.Item>
                      <Button danger type="text" onClick={() => remove(f.name)} style={{ marginTop: 30 }}>삭제</Button>
                      <Form.Item {...f} name={[f.name, 'ingredientName']} hidden><Input /></Form.Item>
                    </Flex>
                  ))}
                </Space>
              </Card>
            )}
          </Form.List>

          {/* 프렙 섹션 */}
          <Form.List name="prepItems">
            {(fields, { add, remove }) => (
              <Card size="small" title="프렙" extra={<Button size="small" onClick={() => add()}>추가</Button>}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {fields.length === 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>프렙을 추가하세요.</Typography.Text>
                  )}
                  {fields.map((f) => (
                    <Flex key={f.key} gap={8} align="start">
                      <Form.Item
                        {...f}
                        name={[f.name, 'prepId']}
                        label="프렙"
                        rules={[{ required: true, message: '프렙 선택' }]}
                        style={{ flex: 1, marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder="프렙 선택"
                          optionFilterProp="label"
                          options={preps.map((p) => ({
                            value: p.id,
                            label: p.yieldAmount
                              ? `${p.name} (${p.yieldAmount}${p.yieldUnit ?? 'g'} 기준)`
                              : p.name,
                          }))}
                          onChange={(id) => {
                            const prep = prepById.get(id)
                            form.setFieldValue(['prepItems', f.name, 'prepName'], prep?.name ?? '')
                            form.setFieldValue(['prepItems', f.name, 'unitLabel'], prep?.yieldUnit ?? 'g')
                          }}
                        />
                      </Form.Item>
                      <Form.Item label="사용량" style={{ width: 180, marginBottom: 0 }}>
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item {...f} name={[f.name, 'amount']} rules={[{ required: true, message: '사용량' }]} noStyle>
                            <InputNumber min={0} style={{ width: 120 }} />
                          </Form.Item>
                          <Form.Item
                            shouldUpdate={(prev, cur) =>
                              (prev.prepItems?.[f.name]?.prepId ?? '') !==
                              (cur.prepItems?.[f.name]?.prepId ?? '')
                            }
                            noStyle
                          >
                            {() => {
                              const id = String(form.getFieldValue(['prepItems', f.name, 'prepId']) ?? '')
                              return <Button disabled style={{ width: 60 }}>{id ? prepUnitLabelOf(id) : '-'}</Button>
                            }}
                          </Form.Item>
                        </Space.Compact>
                      </Form.Item>
                      <Button danger type="text" onClick={() => remove(f.name)} style={{ marginTop: 30 }}>삭제</Button>
                      <Form.Item {...f} name={[f.name, 'prepName']} hidden><Input /></Form.Item>
                      <Form.Item {...f} name={[f.name, 'unitLabel']} hidden><Input /></Form.Item>
                    </Flex>
                  ))}
                </Space>
              </Card>
            )}
          </Form.List>
        </Form>
      </Modal>
    </MobileShell>
  )
}
