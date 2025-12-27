import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Person, Schedule } from '../types';
import { loadSchedules, deleteSchedule } from '../storage';
import { exportSchedulesToXlsx } from '../generator';
import { getDaysInMonth } from '../validator';

export function ManageSchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = loadSchedules();
    setSchedules(data);
  };

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteSchedule(id);
      loadData();
    }
  };

  const handleExport = () => {
    const filtered = getFilteredSchedules();
    if (filtered.length === 0) {
      alert('내보낼 스케줄이 없습니다.');
      return;
    }
    exportSchedulesToXlsx(filtered);
  };

  const renderCalendar = (s: Schedule) => {
    const daysInMonth = getDaysInMonth(s.year, s.month);
    const firstWeekday = new Date(s.year, s.month - 1, 1).getDay();
    const totalCells = firstWeekday + daysInMonth;
    const weekCount = Math.ceil(totalCells / 7);
    const cells = Array.from({ length: weekCount * 7 }, (_, i) => {
      const dayNum = i - firstWeekday + 1;
      return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null;
    });

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        <div className="grid grid-cols-7 gap-px">
          {dayNames.map((name: string, idx) => (
            <div
              key={name}
              className={
                'bg-slate-50 px-2 py-2 text-center text-xs font-semibold ' +
                (idx === 0 || idx === 6 ? 'text-rose-600' : 'text-slate-600')
              }
            >
              {name}
            </div>
          ))}

          {cells.map((dayNum: number | null, idx: number) => {
            if (!dayNum) {
              return <div key={`e-${idx}`} className="min-h-24 bg-white/60" />;
            }

            const assignment = s.assignments.find(a => a.date === dayNum);
            const openPeople = assignment ? assignment.people.filter(p => p.shift === 'open') : [];
            const middlePeople = assignment ? assignment.people.filter(p => p.shift === 'middle') : [];
            const closePeople = assignment ? assignment.people.filter(p => p.shift === 'close') : [];

            const formatAssignedName = (personName: string, isHalf?: boolean) =>
              isHalf ? `${personName}(하프)` : personName;

            const dateObj = new Date(s.year, s.month - 1, dayNum);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            return (
              <div key={dayNum} className="min-h-24 bg-white p-2">
                <div className={isWeekend ? 'text-xs font-semibold text-rose-600' : 'text-xs font-semibold text-slate-900'}>
                  {dayNum}
                </div>
                <div className="mt-1 flex min-w-0 flex-col gap-1 text-[11px] text-slate-700">
                  <div className="flex min-w-0 gap-1">
                    <span className="w-8 shrink-0 font-semibold text-slate-500">오픈</span>
                    <span className="min-w-0 break-words">
                      {openPeople.map(p => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}
                    </span>
                  </div>
                  <div className="flex min-w-0 gap-1">
                    <span className="w-8 shrink-0 font-semibold text-slate-500">미들</span>
                    <span className="min-w-0 break-words">
                      {middlePeople.map(p => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}
                    </span>
                  </div>
                  <div className="flex min-w-0 gap-1">
                    <span className="w-8 shrink-0 font-semibold text-slate-500">마감</span>
                    <span className="min-w-0 break-words">
                      {closePeople.map(p => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getFilteredSchedules = () => {
    return schedules.filter(schedule => {
      if (filterYear && schedule.year !== parseInt(filterYear)) return false;
      if (filterMonth && schedule.month !== parseInt(filterMonth)) return false;
      if (filterName) {
        const hasName = schedule.people.some(p => 
          p.name.toLowerCase().includes(filterName.toLowerCase())
        );
        if (!hasName) return false;
      }
      return true;
    });
  };

  const filtered = getFilteredSchedules();

  return (
    <div className="mx-auto w-full max-w-5xl px-3">
      <h1 className="mb-2 text-lg font-semibold text-slate-900">스케줄 관리/조회</h1>

      <Card title="필터">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            type="number"
            label="연도"
            value={filterYear}
            onChange={(e) => setFilterYear((e.target as HTMLInputElement).value)}
            placeholder="전체"
          />
          <Input
            type="number"
            label="월"
            value={filterMonth}
            onChange={(e) => setFilterMonth((e.target as HTMLInputElement).value)}
            placeholder="전체"
            min={1}
            max={12}
          />
          <Input
            label="인원 이름"
            value={filterName}
            onChange={(e) => setFilterName((e.target as HTMLInputElement).value)}
            placeholder="검색"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleExport} variant="secondary">
            엑셀 내보내기
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-600">저장된 스케줄이 없습니다.</p>
            <div>
              <Button onClick={() => navigate('/create')}>새 스케줄 만들기</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(schedule => (
            <Card key={schedule.id} title={`${schedule.year}년 ${schedule.month}월`}>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-700">근무 인원:</span>
                  <span className="break-words text-slate-700">{schedule.people.map((p: Person) => p.name).join(', ')}</span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-700">생성일:</span>
                  <span className="text-slate-700">{new Date(schedule.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-700">수정일:</span>
                  <span className="text-slate-700">{new Date(schedule.updatedAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>

              <h4 className="mt-3 text-sm font-semibold text-slate-900">인원별 근무 통계</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {schedule.people.map((person: Person) => {
                  const fullWorkDays = schedule.assignments
                    .filter(day => day.people.some(p => p.personId === person.id && !p.isHalf))
                    .map(day => day.date);

                  const halfDays = schedule.assignments
                    .filter(day => day.people.some(p => p.personId === person.id && !!p.isHalf))
                    .map(day => day.date);

                  const workEquivalent = fullWorkDays.length + halfDays.length * 0.5;
                  const offDays = person.requestedDaysOff;
                  const offEquivalent = offDays.length + halfDays.length * 0.5;

                  return (
                    <div key={person.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                      <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-semibold text-slate-600">근무(환산)</span>
                          <span>{workEquivalent}일</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-semibold text-slate-600">하프</span>
                          <span>{halfDays.length}일</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-semibold text-slate-600">휴무(환산)</span>
                          <span>{offEquivalent}일</span>
                        </div>
                      </div>
                      {offDays.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600">
                          <span className="font-semibold">휴무일:</span> {offDays.sort((a, b) => a - b).join(', ')}일
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h4 className="mt-3 text-sm font-semibold text-slate-900">달력 전체 보기</h4>
              <div className="mt-2">{renderCalendar(schedule)}</div>

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button onClick={() => navigate('/create', { state: { editScheduleId: schedule.id } })} variant="secondary">
                  수정
                </Button>
                <Button onClick={() => handleDelete(schedule.id)} variant="danger">
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
