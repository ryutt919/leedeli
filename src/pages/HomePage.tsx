import { Link } from 'react-router-dom';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { WorkRules } from '../constants';
import { getWorkRules, saveWorkRules } from '../workRules';

export function HomePage() {
  const [rules, setRules] = useState<WorkRules>(getWorkRules());

  useEffect(() => {
    setRules(getWorkRules());
  }, []);

  const handleSaveRules = () => {
    const baseUnitsRaw = rules.DAILY_STAFF_BASE * 2;
    const maxUnitsRaw = rules.DAILY_STAFF_MAX * 2;

    if (!rules.DAILY_STAFF_BASE || rules.DAILY_STAFF_BASE < 0.5 || rules.DAILY_STAFF_BASE > 20 || !Number.isInteger(baseUnitsRaw)) {
      alert('기본 근무 인원은 0.5~20 사이(0.5 단위)로 입력해주세요.');
      return;
    }
    if (!rules.DAILY_STAFF_MAX || rules.DAILY_STAFF_MAX < rules.DAILY_STAFF_BASE || rules.DAILY_STAFF_MAX > 20 || !Number.isInteger(maxUnitsRaw)) {
      alert('최대 근무 인원은 기본 근무 인원 이상, 20 이하(0.5 단위)로 입력해주세요.');
      return;
    }
    if (rules.WORK_HOURS < 1 || rules.WORK_HOURS > 24) {
      alert('근무 시간은 1~24 사이로 입력해주세요.');
      return;
    }
    if (rules.BREAK_HOURS < 0 || rules.BREAK_HOURS > 8) {
      alert('휴게 시간은 0~8 사이로 입력해주세요.');
      return;
    }

    saveWorkRules(rules);
    alert('근무 규칙이 저장되었습니다.');
  };

  return (
    <div className="container">
      <div className="cards-grid">
        <div className="card card-action" onClick={() => window.location.href='/create'} tabIndex={0} role="button">
          <div className="card-title">근무 스케줄 생성</div>
        </div>
        <div className="card card-action" onClick={() => window.location.href='/manage'} tabIndex={0} role="button">
          <div className="card-title">스케줄 관리/조회</div>
        </div>
        <div className="card card-action" onClick={() => window.location.href='/preps'} tabIndex={0} role="button">
          <div className="card-title">프렙/소스 관리</div>
        </div>
        <div className="card card-action" onClick={() => window.location.href='/ingredients'} tabIndex={0} role="button">
          <div className="card-title">재료 관리</div>
        </div>
      </div>

      <div className="info-section">
        <h2>근무 규칙</h2>
        <div className="info-grid">
          <div className="info-item">
            <strong>기본 근무 인원</strong>
            <input
              className="input"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              value={rules.DAILY_STAFF_BASE}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRules({ ...rules, DAILY_STAFF_BASE: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="info-item">
            <strong>최대 근무 인원</strong>
            <input
              className="input"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              value={rules.DAILY_STAFF_MAX}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRules({ ...rules, DAILY_STAFF_MAX: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="info-item">
            <strong>1인 근무 시간</strong>
            <div className="rule-inline">
              <div className="rule-inline-item">
                <span className="rule-inline-label">근무</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={24}
                  value={rules.WORK_HOURS}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRules({ ...rules, WORK_HOURS: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="rule-inline-item">
                <span className="rule-inline-label">휴게</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={8}
                  value={rules.BREAK_HOURS}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRules({ ...rules, BREAK_HOURS: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="actions">
          <Button variant="primary" onClick={handleSaveRules}>
            규칙 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
