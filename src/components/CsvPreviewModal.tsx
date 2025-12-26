import React, { useState } from 'react';
import type { CsvPreviewItem, CsvAction } from '../types';
import { Button } from './Button';

type Props = {
  items: CsvPreviewItem[];
  open: boolean;
  onClose: () => void;
  onApply: (actions: Record<number, CsvAction>) => void;
};

export function CsvPreviewModal({ items, open, onClose, onApply }: Props) {
  const [actions, setActions] = useState<Record<number, CsvAction>>(() => {
    const map: Record<number, CsvAction> = {};
    items.forEach(it => { map[it.rowNumber] = it.recommendedAction; });
    return map;
  });

  if (!open) return null;

  const handleChange = (row: number, action: CsvAction) => {
    setActions(prev => ({ ...prev, [row]: action }));
  };

  const handleApply = () => {
    onApply(actions);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: '90%', maxWidth: 1000, maxHeight: '80vh', overflow: 'auto', background: 'white', borderRadius: 8, padding: 16 }}>
        <h3>CSV 업로드 미리보기</h3>
        <div style={{ marginBottom: 8 }}>행 수: {items.length}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>#</th>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>원본</th>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>파싱</th>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>매칭</th>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>권장</th>
                <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.rowNumber}>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>{it.rowNumber}</td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.raw}</td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 12, color: '#333' }}>
                      {Object.entries(it.parsed).map(([k, v]) => (
                        <div key={k}><strong>{k}: </strong>{Array.isArray(v) ? v.join(';') : String(v)}</div>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>{it.detectedMatch ? it.detectedMatch.type : '없음'}</td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>{it.recommendedAction}</td>
                  <td style={{ padding: '8px 4px', verticalAlign: 'top' }}>
                    <select value={actions[it.rowNumber]} onChange={(e) => handleChange(it.rowNumber, e.target.value as CsvAction)}>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="merge">Merge</option>
                      <option value="skip">Skip</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleApply}>선택 적용</Button>
        </div>
      </div>
    </div>
  );
}

export default CsvPreviewModal;
