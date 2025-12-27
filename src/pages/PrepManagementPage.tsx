import { useState, useEffect, type ChangeEvent } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { loadPreps, savePreps, deletePrep, applyPreviewActionsForPreps } from '../storage';
import { loadIngredients } from '../storage';
import CsvPreviewModal from '../components/CsvPreviewModal';
import type { CsvPreviewItem, CsvAction } from '../types';
import { exportPrepsToXlsx, exportPrepsToCsv } from '../generator';
import type { Prep, PrepIngredient, Ingredient } from '../types';

export function PrepManagementPage() {
  const [preps, setPreps] = useState<Prep[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expandedPreps, setExpandedPreps] = useState<Set<string>>(new Set());
  const [editingPrep, setEditingPrep] = useState<Prep | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewItems, setPreviewItems] = useState<CsvPreviewItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    const loadedIngredients = loadIngredients();
    const loadedPreps = loadPreps();
    const updatedPreps = loadedPreps.map(prep => ({
      ...prep,
      totalCost: calculateTotalCostForPrep(prep.ingredients, loadedIngredients),
      nextReplenishDate: calculateExpectedReplenishDate(prep) || prep.nextReplenishDate
    }));
    setIngredients(loadedIngredients);
    setPreps(updatedPreps);
  };

  const calculateTotalCostForPrep = (prepIngredients: PrepIngredient[], ingredientsList: Ingredient[]): number => {
    return prepIngredients.reduce((total, prepIng) => {
      const ingredient = ingredientsList.find(i => i.id === prepIng.ingredientId);
      return ingredient ? total + (ingredient.unitPrice * prepIng.quantity) : total;
    }, 0);
  };

  const calculateTotalCost = (prepIngredients: PrepIngredient[]) => calculateTotalCostForPrep(prepIngredients, ingredients);

  const toggleExpand = (prepId: string) => { const newExpanded = new Set(expandedPreps); newExpanded.has(prepId) ? newExpanded.delete(prepId) : newExpanded.add(prepId); setExpandedPreps(newExpanded); };

  const calculateAverageReplenishInterval = (replenishHistory: string[]): number | null => {
    if (replenishHistory.length < 2) return null;
    const intervals: number[] = [];
    for (let i = 1; i < replenishHistory.length; i++) {
      const prev = new Date(replenishHistory[i - 1]);
      const cur = new Date(replenishHistory[i]);
      intervals.push((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    }
    return Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
  };

  const calculateExpectedReplenishDate = (prep: Prep): string | null => {
    if (!prep.replenishHistory || prep.replenishHistory.length === 0) return null;
    const avg = calculateAverageReplenishInterval(prep.replenishHistory);
    if (avg === null) return null;
    const last = new Date(prep.replenishHistory[prep.replenishHistory.length - 1]);
    last.setDate(last.getDate() + avg);
    return last.toISOString().split('T')[0];
  };

  const handleAddPrep = () => { setEditingPrep({ id: String(Date.now()), name: '', ingredients: [], replenishHistory: [], totalCost: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setShowAddForm(true); };

  const handleEditPrep = (prep: Prep) => { setEditingPrep({ ...prep }); setShowAddForm(true); };

  const handleSavePrep = () => {
    if (!editingPrep || !editingPrep.name.trim()) { alert('프렙/소스 이름을 입력해주세요.'); return; }
    const totalCost = calculateTotalCost(editingPrep.ingredients);
    const expectedDate = calculateExpectedReplenishDate(editingPrep);
    const prepToSave: Prep = { ...editingPrep, totalCost, nextReplenishDate: expectedDate || undefined, updatedAt: new Date().toISOString() };
    const existingPreps = loadPreps();
    const existingIndex = existingPreps.findIndex(p => p.id === prepToSave.id);
    if (existingIndex >= 0) existingPreps[existingIndex] = prepToSave; else existingPreps.push(prepToSave);
    savePreps(existingPreps); loadData(); setShowAddForm(false); setEditingPrep(null);
  };

  const handleAddReplenishDate = (prepId: string, date: string) => {
    const prep = preps.find(p => p.id === prepId); if (!prep) return;
    const newHistory = [...prep.replenishHistory, date].sort();
    const updatedPrep: Prep = { ...prep, replenishHistory: newHistory, nextReplenishDate: calculateExpectedReplenishDate({ ...prep, replenishHistory: newHistory }) || undefined, updatedAt: new Date().toISOString() };
    const existingPreps = loadPreps(); const idx = existingPreps.findIndex(p => p.id === prepId); if (idx >= 0) { existingPreps[idx] = updatedPrep; savePreps(existingPreps); }
    loadData();
  };

  const handleRemoveReplenishDate = (prepId: string, dateToRemove: string) => {
    const prep = preps.find(p => p.id === prepId); if (!prep) return;
    const newHistory = prep.replenishHistory.filter(d => d !== dateToRemove);
    const updatedPrep: Prep = { ...prep, replenishHistory: newHistory, nextReplenishDate: calculateExpectedReplenishDate({ ...prep, replenishHistory: newHistory }) || undefined, updatedAt: new Date().toISOString() };
    const existingPreps = loadPreps(); const idx = existingPreps.findIndex(p => p.id === prepId); if (idx >= 0) { existingPreps[idx] = updatedPrep; savePreps(existingPreps); }
    loadData();
  };

  const handleDeletePrep = (id: string) => { if (confirm('정말 삭제하시겠습니까?')) { deletePrep(id); loadData(); } };

  const handleAddIngredient = () => { if (!editingPrep) return; const newIngredient: PrepIngredient = { ingredientId: '', ingredientName: '', quantity: 0 }; setEditingPrep({ ...editingPrep, ingredients: [...editingPrep.ingredients, newIngredient] }); };

  const handleRemoveIngredient = (index: number) => { if (!editingPrep) return; setEditingPrep({ ...editingPrep, ingredients: editingPrep.ingredients.filter((_, i) => i !== index) }); };

  const handleIngredientChange = (index: number, field: keyof PrepIngredient, value: string | number) => {
    if (!editingPrep) return; const updated = [...editingPrep.ingredients]; updated[index] = { ...updated[index], [field]: value };
    if (field === 'ingredientId') { const ingredient = ingredients.find(i => i.id === value); if (ingredient) updated[index].ingredientName = ingredient.name; }
    setEditingPrep({ ...editingPrep, ingredients: updated });
  };

  // CSV helper
  const parseCsvLine = (line: string): string[] => {
    const res: string[] = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { inQuotes = !inQuotes; continue; } if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; continue; } cur += ch; }
    res.push(cur); return res.map(s => s.replace(/\uFEFF/g, '').trim());
  };
  const normalizeField = (s?: string) => (s || '').replace(/\uFEFF/g, '').replace(/^"|"$/g, '').trim();

  // CSV 업로드: 같은 프렙/소스명은 하나로 합치고, 누락 재료는 자동 생성(중복시 확인)
  const handleCSVUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) { alert('CSV 파일 형식이 올바르지 않습니다.'); return; }

      const dataLines = lines.slice(1);
      const existingIngredients = loadIngredients();
      const existingNameMap: Record<string, number> = {};
      existingIngredients.forEach((ing, i) => { existingNameMap[(ing.name || '').toLowerCase()] = i; });

      const existingPreps = loadPreps();
      const existingPrepNameMap: Record<string, number> = {};
      existingPreps.forEach((p, i) => { existingPrepNameMap[(p.name || '').toLowerCase()] = i; });

      const items: CsvPreviewItem[] = [];

      dataLines.forEach((line, idx) => {
        const parts = parseCsvLine(line);
        const nameRaw = normalizeField(parts[0]);
        const ingredientNameRaw = normalizeField(parts[1]);
        const quantityStr = normalizeField(parts[2]);
        const replenishDatesRaw = parts.slice(3).map(normalizeField).filter(Boolean);
        const rowNumber = idx + 2;
        const parsed: Record<string, any> = { prepName: nameRaw, ingredientName: ingredientNameRaw, quantity: quantityStr, replenishDates: replenishDatesRaw };
        const validationErrors: string[] = [];
        if (!nameRaw) validationErrors.push('프렙/소스명 누락');
        if (!ingredientNameRaw) validationErrors.push('재료명 누락');
        if (quantityStr && isNaN(parseFloat(quantityStr))) validationErrors.push('투입량 숫자 형식 오류');

        const key = (nameRaw || '').toLowerCase();
        const matchedIndex = existingPrepNameMap.hasOwnProperty(key) ? existingPrepNameMap[key] : -1;
        const detectedMatch = matchedIndex >= 0
          ? { type: 'name_exact' as const, id: existingPreps[matchedIndex].id, existing: existingPreps[matchedIndex] }
          : undefined;
        const recommendedAction: CsvAction = detectedMatch ? 'merge' : 'create';

        // 자동 무시: 동일한 프렙/소스이 존재하고, 해당 프렙/소스이 이미 같은 재료/투입량을 포함하며 보충 날짜도 동일하면 미리보기에 추가하지 않음
        if (detectedMatch && detectedMatch.existing) {
          const exPrep = detectedMatch.existing as Prep;
          const qtyNum = parseFloat(String(parsed.quantity || '0') || '0');
          const ingredientMatch = exPrep.ingredients && exPrep.ingredients.some(ing => ((ing.ingredientName || '').toLowerCase() === (parsed.ingredientName || '').toString().toLowerCase()) && ing.quantity === qtyNum);
          const parsedDates = Array.isArray(parsed.replenishDates) ? parsed.replenishDates : (parsed.replenishDates ? [parsed.replenishDates] : []);
          const datesEqual = JSON.stringify((exPrep.replenishHistory || []).slice().sort()) === JSON.stringify((parsedDates || []).slice().sort());
          if (ingredientMatch && datesEqual) {
            // 완전 일치 → 자동 무시
            return;
          }
        }

        items.push({ rowNumber, raw: line, parsed, detectedMatch, recommendedAction, validationErrors });
      });

      setPreviewItems(items);
      setShowPreview(true);
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  const handleApplyPreview = (items: CsvPreviewItem[], actions: Record<number, CsvAction>) => {
    if (!items || items.length === 0) return;
    const result = applyPreviewActionsForPreps(items, actions);
    setShowPreview(false);
    setPreviewItems([]);
    loadData();
    alert(`${result.created || 0}개의 프렙/소스이 생성/병합되었습니다.`);
  };

  const handleResetPreps = () => { if (!confirm('정말 모든 프렙/소스을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return; if (!confirm('진짜로 초기화?')) return; savePreps([]); loadData(); alert('모든 프렙/소스이 초기화되었습니다.'); };

  const formatDate = (dateString?: string) => { if (!dateString) return '미설정'; const date = new Date(dateString); return date.toLocaleDateString('ko-KR'); };

  return (
    <div className="mx-auto w-full max-w-5xl px-3">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">프렙/소스 관리</h1>
      <p className="mb-3 text-xs text-slate-500">csv 구조 : 이름,재료명,투입량,보충날짜1(2025-12-20)..</p>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleAddPrep}>프렙/소스 추가</Button>
        <label className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 active:bg-slate-50">
          CSV 업로드
          <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
        </label>
        <Button variant="secondary" onClick={() => exportPrepsToXlsx(preps)}>엑셀 내보내기</Button>
        <Button variant="secondary" onClick={() => exportPrepsToCsv(preps)}>CSV 내보내기</Button>
        <Button variant="danger" onClick={handleResetPreps}>프렙/소스 초기화</Button>
      </div>

      <CsvPreviewModal items={previewItems} open={showPreview} onClose={() => setShowPreview(false)} onApply={handleApplyPreview} />

      {showAddForm && editingPrep && (
        <Card title={editingPrep.id ? '프렙/소스 수정' : '프렙/소스 추가'}>
          <div className="grid grid-cols-1 gap-2">
            <Input
              label="프렙/소스 이름"
              value={editingPrep.name}
              onChange={(e) => setEditingPrep({ ...editingPrep, name: e.target.value })}
              placeholder="예: 오이피클"
              autoFocus
            />
          </div>

          <div className="mt-3 text-sm font-semibold text-slate-900">보충 이력</div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {editingPrep.replenishHistory.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">보충 날짜 목록</div>
                <div className="flex flex-col gap-2">
                  {editingPrep.replenishHistory.map((date, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">{formatDate(date)}</span>
                      <Button
                        variant="danger"
                        onClick={() => {
                          const newHistory = editingPrep.replenishHistory.filter((_, i) => i !== idx);
                          setEditingPrep({ ...editingPrep, replenishHistory: newHistory });
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
                {editingPrep.replenishHistory.length >= 2 && (
                  <div className="mt-2 text-xs text-slate-600">
                    평균 보충 간격: {calculateAverageReplenishInterval(editingPrep.replenishHistory)}일
                  </div>
                )}
              </div>
            )}

            <Input
              type="date"
              label="보충 날짜 추가"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const newHistory = [...editingPrep.replenishHistory, e.target.value].sort();
                  setEditingPrep({ ...editingPrep, replenishHistory: newHistory });
                  e.target.value = '';
                }
              }}
            />
          </div>
          {editingPrep.replenishHistory.length >= 2 && (
            <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-900">
              <span className="font-semibold">예상 보충 날짜:</span> {formatDate(calculateExpectedReplenishDate(editingPrep) || undefined)}
            </div>
          )}

          <div className="mt-3 text-sm font-semibold text-slate-900">재료 목록</div>
          {editingPrep.ingredients.map((prepIng, index) => (
            <div key={index} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,1fr,auto]">
                <div className="flex w-full flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">재료</label>
                  <select
                    value={prepIng.ingredientId}
                    onChange={(e) => handleIngredientChange(index, 'ingredientId', e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">재료 선택</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  label="투입량"
                  min={0}
                  step={0.01}
                  value={prepIng.quantity}
                  onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                />
                <div className="flex items-end">
                  <Button variant="danger" onClick={() => handleRemoveIngredient(index)}>삭제</Button>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-2 flex justify-end">
            <Button variant="secondary" onClick={handleAddIngredient}>
              재료 추가
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="primary" onClick={handleSavePrep}>
              저장
            </Button>
            <Button variant="secondary" onClick={() => { setShowAddForm(false); setEditingPrep(null); }}>
              취소
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {preps.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">등록된 프렙/소스이 없습니다.</div>
        ) : (
          preps.map(prep => (
            <Card key={prep.id}>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(prep.id)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left active:bg-slate-100"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{prep.name}</div>
                      <div className="mt-1 text-xs text-slate-600">다음 보충 예상: {formatDate(prep.nextReplenishDate)}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-700">총 재료 비용: {prep.totalCost.toLocaleString('ko-KR')}원</div>
                  </div>
                </button>

                {expandedPreps.has(prep.id) && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">보충 이력</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {prep.replenishHistory.length === 0 ? (
                          <p className="text-sm text-slate-600">보충 이력이 없습니다.</p>
                        ) : (
                          <div className="mb-3 flex flex-col gap-2">
                            {prep.replenishHistory.map((date, idx) => (
                              <div key={idx} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm text-slate-700">{formatDate(date)}</span>
                                <Button variant="danger" onClick={() => handleRemoveReplenishDate(prep.id, date)}>
                                  삭제
                                </Button>
                              </div>
                            ))}
                            {prep.replenishHistory.length >= 2 && (
                              <div className="text-xs text-slate-600">평균 보충 간격: {calculateAverageReplenishInterval(prep.replenishHistory)}일</div>
                            )}
                          </div>
                        )}
                        <Input
                          type="date"
                          label="보충 날짜 추가"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddReplenishDate(prep.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">재료 목록</div>
                      {prep.ingredients.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">등록된 재료가 없습니다.</p>
                      ) : (
                        <div className="mt-2 w-full overflow-x-auto rounded-xl border border-slate-200">
                          <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500">
                              <tr>
                                <th className="border-b border-slate-200 px-3 py-2">재료명</th>
                                <th className="border-b border-slate-200 px-3 py-2">투입량</th>
                                <th className="border-b border-slate-200 px-3 py-2">단위 가격</th>
                                <th className="border-b border-slate-200 px-3 py-2">총 가격</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prep.ingredients.map((prepIng, index) => {
                                const ingredient = ingredients.find(i => i.id === prepIng.ingredientId);
                                const itemTotal = ingredient ? ingredient.unitPrice * prepIng.quantity : 0;
                                return (
                                  <tr key={index} className="odd:bg-white even:bg-slate-50/40">
                                    <td className="px-3 py-2">{prepIng.ingredientName || '알 수 없음'}</td>
                                    <td className="px-3 py-2">{prepIng.quantityText && String(prepIng.quantityText).trim() !== '' ? prepIng.quantityText : prepIng.quantity}</td>
                                    <td className="px-3 py-2">{ingredient ? `${ingredient.unitPrice.toLocaleString('ko-KR')}원` : '-'}</td>
                                    <td className="px-3 py-2">{itemTotal.toLocaleString('ko-KR')}원</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => handleEditPrep(prep)}>수정</Button>
                      <Button variant="danger" onClick={() => handleDeletePrep(prep.id)}>삭제</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

