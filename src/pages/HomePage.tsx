import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { WorkRules } from '../constants';
import { getWorkRules, saveWorkRules } from '../workRules';

export function HomePage() {
  const navigate = useNavigate();
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
    <div className="mx-auto w-full max-w-5xl px-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card bg-base-100 shadow-md border border-base-200 rounded-box p-0">
          <button
            type="button"
            onClick={() => navigate('/create')}
            className="btn btn-block btn-lg btn-pastel mb-0 rounded-b-none rounded-t-box"
          >
            <span className="font-bold text-base-content">근무 스케줄 생성</span>
            <span className="block text-xs text-base-content/60">새 스케줄 만들기</span>
          </button>
        </div>
        <div className="card bg-base-100 shadow-md border border-base-200 rounded-box p-0">
          <button
            type="button"
            onClick={() => navigate('/manage')}
            className="btn btn-block btn-lg btn-pastel mb-0 rounded-b-none rounded-t-box"
          >
            <span className="font-bold text-base-content">스케줄 관리/조회</span>
            <span className="block text-xs text-base-content/60">저장된 스케줄 보기</span>
          </button>
        </div>
        <div className="card bg-base-100 shadow-md border border-base-200 rounded-box p-0">
          <button
            type="button"
            onClick={() => navigate('/preps')}
            className="btn btn-block btn-lg btn-pastel mb-0 rounded-b-none rounded-t-box"
          >
            <span className="font-bold text-base-content">프렙/소스 관리</span>
            <span className="block text-xs text-base-content/60">CSV 업로드/편집</span>
          </button>
        </div>
        <div className="card bg-base-100 shadow-md border border-base-200 rounded-box p-0">
          <button
            type="button"
            onClick={() => navigate('/ingredients')}
            className="btn btn-block btn-lg btn-pastel mb-0 rounded-b-none rounded-t-box"
          >
            <span className="font-bold text-base-content">재료 관리</span>
            <span className="block text-xs text-base-content/60">CSV 업로드/편집</span>
          </button>
        </div>
      </div>

      <div className="mt-4 card bg-base-100 shadow border border-base-200 rounded-box p-4">
        <div className="mb-2 text-base font-bold text-base-content">근무 규칙</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="number"
            label="기본 근무 인원"
            min={0.5}
            max={20}
            step={0.5}
            value={rules.DAILY_STAFF_BASE}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRules({ ...rules, DAILY_STAFF_BASE: parseFloat(e.target.value) || 0 })
            }
          />
          <Input
            type="number"
            label="최대 근무 인원"
            min={0.5}
            max={20}
            step={0.5}
            value={rules.DAILY_STAFF_MAX}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRules({ ...rules, DAILY_STAFF_MAX: parseFloat(e.target.value) || 0 })
            }
          />
          <div className="flex flex-col gap-1 sm:col-span-2">
            <div className="text-xs font-medium text-slate-600">1인 근무 시간</div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                label="근무"
                min={1}
                max={24}
                value={rules.WORK_HOURS}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setRules({ ...rules, WORK_HOURS: parseInt(e.target.value) || 0 })
                }
              />
              <Input
                type="number"
                label="휴게"
                min={0}
                max={8}
                value={rules.BREAK_HOURS}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setRules({ ...rules, BREAK_HOURS: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={handleSaveRules}>
            규칙 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
