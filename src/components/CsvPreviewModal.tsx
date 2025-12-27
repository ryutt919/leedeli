import { useState, useEffect } from 'react';
import type { CsvPreviewItem, CsvAction } from '../types';
import { Button } from './Button';

type Props = {
  items: CsvPreviewItem[];
  open: boolean;
  onClose: () => void;
  // onApply: pass back updated items and chosen actions
  onApply: (items: CsvPreviewItem[], actions: Record<number, CsvAction>) => void;
};

export function CsvPreviewModal({ items, open, onClose, onApply }: Props) {
  const [actions, setActions] = useState<Record<number, CsvAction>>(() => {
    const map: Record<number, CsvAction> = {};
    items.forEach(it => { map[it.rowNumber] = 'update'; });
    return map;
  });
  const [bulkAction, setBulkAction] = useState<CsvAction>('create');
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // initialize selections when items change
    const sel: Record<number, boolean> = {};
    items.forEach(it => { sel[it.rowNumber] = true; });
    setSelected(sel);
    // reset actions defaults
    const act: Record<number, CsvAction> = {};
    items.forEach(it => { act[it.rowNumber] = 'update'; });
    setActions(act);
  }, [items]);

  if (!open) return null;

  const handleToggleAction = (row: number) => {
    setActions(prev => ({ ...prev, [row]: prev[row] === 'skip' ? 'update' : 'skip' }));
  };

  const toggleSelect = (row: number) => {
    setSelected(prev => ({ ...prev, [row]: !prev[row] }));
  };

  const handleApply = () => {
    // build updated items (no inline edits in simple view)
    onApply(items, actions);
  };

  function renderParsedSummary(parsed?: Record<string, any>) {
    if (!parsed) return null;
    // detect ingredient-style parsed (name, price, purchaseUnit)
    const ingName = parsed.name || parsed.ingredientName || parsed['ingredientName'];
    const price = parsed.price || parsed.unitPrice || parsed['price'];
    const purchaseUnit = parsed.purchaseUnit || parsed['purchaseUnit'];

    if (ingName && (price !== undefined || purchaseUnit !== undefined)) {
      return (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">재료 :</div>
          <div className="truncate text-sm text-slate-900">{ingName}</div>

          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">구매 가격 :</div>
          {price !== undefined ? <div className="text-sm text-slate-900">{price}</div> : <div className="text-sm text-slate-400">-</div>}

          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">구매 단위 :</div>
          {purchaseUnit !== undefined ? (
            <div className="text-sm text-slate-900">{purchaseUnit}</div>
          ) : (
            <div className="text-sm text-slate-400">-</div>
          )}
        </div>
      );
    }

    // otherwise treat as prep-style parsed
    const pName = parsed.prepName || parsed.name || parsed['prepName'];
    const iName = parsed.ingredientName || parsed['ingredientName'] || parsed['ingredient'];
    const qty = parsed.quantity || parsed.qty || parsed['수량'];
    const dates = parsed.replenishDates || parsed.replenish || parsed['replenishDates'];

    return (
      <div className="flex flex-col gap-2">
        {pName ? (
          <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
            <div className="whitespace-nowrap text-xs font-semibold text-slate-600">프렙/소스명 :</div>
            <div className="truncate text-sm text-slate-900">{pName}</div>
          </div>
        ) : null}
        {iName || qty ? (
          <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
            <div className="whitespace-nowrap text-xs font-semibold text-slate-600">재료 :</div>
            <div className="truncate text-sm text-slate-900">{iName || '-'}</div>
            <div className="whitespace-nowrap text-xs font-semibold text-slate-600">투입량 :</div>
            {qty !== undefined && qty !== '' ? <div className="text-sm text-slate-900">{qty}</div> : <div className="text-sm text-slate-400">-</div>}
          </div>
        ) : null}
        {dates && Array.isArray(dates) && dates.length ? (
          <div className="text-xs text-slate-500">보충: {dates.join(', ')}</div>
        ) : null}
      </div>
    );
  }

  function renderExistingSummary(existing: any) {
    if (!existing) return null;
    // Ingredient existing
    if (existing.hasOwnProperty('purchaseUnit') || existing.hasOwnProperty('unitPrice')) {
      return (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">재료 :</div>
          <div className="truncate text-sm text-slate-900">{existing.name}</div>

          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">구매 가격 :</div>
          <div className="text-sm text-slate-900">{existing.price}</div>

          <div className="whitespace-nowrap text-xs font-semibold text-slate-600">구매 단위 :</div>
          <div className="text-sm text-slate-900">{existing.purchaseUnit}</div>
        </div>
      );
    }

    // Prep existing
    if (existing.hasOwnProperty('ingredients')) {
      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
            <div className="whitespace-nowrap text-xs font-semibold text-slate-600">프렙/소스명 :</div>
            <div className="truncate text-sm text-slate-900">{existing.name}</div>
          </div>
          {Array.isArray(existing.ingredients) && existing.ingredients.length > 0 ? (
            <div className="flex flex-col gap-2">
              {existing.ingredients.map((ing: any, idx: number) => (
                <div key={idx} className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1">
                  <div className="whitespace-nowrap text-xs font-semibold text-slate-600">재료 :</div>
                  <div className="truncate text-sm text-slate-900">{ing.ingredientName || ing.name || ing.ingredient}</div>
                  <div className="whitespace-nowrap text-xs font-semibold text-slate-600">투입량 :</div>
                  <div className="text-sm text-slate-900">{ing.quantity}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">현재 없음</div>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">CSV 업로드 미리보기</h3>
            <div className="text-xs text-slate-500">총 항목: {items.length}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button variant="primary" onClick={handleApply}>선택 적용</Button>
          </div>
        </div>

        <div className="flex max-h-[80dvh] flex-col gap-2 overflow-auto px-3 py-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="text-xs text-slate-500">행 수: {items.length}</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as CsvAction)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                <option value="update">모두 갱신</option>
                <option value="skip">모두 무시</option>
              </select>
              <Button
                variant="secondary"
                onClick={() => {
                  const m: Record<number, CsvAction> = {};
                  items.forEach(it => {
                    m[it.rowNumber] = bulkAction;
                  });
                  setActions(prev => ({ ...prev, ...m }));
                }}
              >
                모두 적용
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="w-12 border-b border-slate-200 py-2">#</th>
                  <th className="border-b border-slate-200 py-2">원본 아이템</th>
                  <th className="border-b border-slate-200 py-2">추가 시도 아이템</th>
                  <th className="w-32 border-b border-slate-200 py-2">액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr
                    key={it.rowNumber}
                    className={selected[it.rowNumber] ? 'bg-sky-50/60' : undefined}
                  >
                    <td className="py-2 align-top">
                      <div className="flex flex-col items-start gap-2">
                        <input
                          type="checkbox"
                          checked={!!selected[it.rowNumber]}
                          onChange={() => toggleSelect(it.rowNumber)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-200"
                        />
                        <div className="text-xs text-slate-500">{it.rowNumber}</div>
                      </div>
                    </td>
                    <td className="py-2 align-top">
                      {it.detectedMatch && it.detectedMatch.existing ? (
                        renderExistingSummary(it.detectedMatch.existing)
                      ) : (
                        <div className="text-sm text-slate-500">현재 없음</div>
                      )}
                    </td>
                    <td className="py-2 align-top">{renderParsedSummary(it.parsed)}</td>
                    <td className="py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleToggleAction(it.rowNumber)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 active:bg-slate-50"
                      >
                        {actions[it.rowNumber] === 'skip' ? '무시' : '갱신'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2 py-1">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button variant="primary" onClick={handleApply}>선택 적용</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CsvPreviewModal;
