import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Checkbox } from '../components/Checkbox';
import { Person, Schedule, ShiftType, ValidationError } from '../types';
import { validateScheduleInputs, getDaysInMonth } from '../validator';
import { generateSchedule, validateGeneratedSchedule, ScheduleGenerationError, exportSchedulesToXlsx } from '../generator';
import { saveSchedule } from '../storage';

type RequestMode = 'off' | 'half';

export function CreateSchedulePage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [peopleCount, setPeopleCount] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [requestModes, setRequestModes] = useState<Record<string, RequestMode>>({});
  const [activeHalfDay, setActiveHalfDay] = useState<Record<string, number | null>>({});

  // 인원 수 변경 시 배열 초기화
  const handlePeopleCountChange = (count: string) => {
    const num = parseInt(count) || 0;
    setPeopleCount(num);
    
    const newPeople: Person[] = [];
    for (let i = 0; i < num; i++) {
      if (people[i]) {
        newPeople.push(people[i]);
      } else {
        newPeople.push({
          id: crypto.randomUUID(),
          name: '',
          canOpen: true,
          canClose: true,
          mustOpen: false,
          mustClose: false,
          requestedDaysOff: [],
          halfRequests: {}
        });
      }
    }
    setPeople(newPeople);
  };

  // 개별 인원 정보 업데이트
  const updatePerson = (index: number, updates: Partial<Person>) => {
    const newPeople = [...people];
    newPeople[index] = { ...newPeople[index], ...updates };
    setPeople(newPeople);
  };

  const getRequestMode = (personId: string): RequestMode => requestModes[personId] ?? 'off';

  const setRequestMode = (personId: string, mode: RequestMode) => {
    setRequestModes(prev => ({ ...prev, [personId]: mode }));
  };

  // 휴무/하프 날짜 선택
  const toggleRequestDay = (personIndex: number, day: number) => {
    const person = people[personIndex];
    const mode = getRequestMode(person.id);

    if (mode === 'off') {
      const newDaysOff = person.requestedDaysOff.includes(day)
        ? person.requestedDaysOff.filter((d: number) => d !== day)
        : [...person.requestedDaysOff, day];

      const newHalfRequests = { ...person.halfRequests };
      if (newDaysOff.includes(day)) {
        delete newHalfRequests[day];
        setActiveHalfDay(prev => (prev[person.id] === day ? { ...prev, [person.id]: null } : prev));
      }

      updatePerson(personIndex, {
        requestedDaysOff: newDaysOff,
        halfRequests: newHalfRequests
      });
      return;
    }

    // half 모드
    const isHalfSelected = person.halfRequests[day] !== undefined;
    const isActive = activeHalfDay[person.id] === day;

    // 이미 선택된 날짜인데 비활성 상태면, 활성화만 (해제 X)
    if (isHalfSelected && !isActive) {
      setActiveHalfDay(prev => ({ ...prev, [person.id]: day }));
      return;
    }

    const newHalfRequests = { ...person.halfRequests };
    if (isHalfSelected && isActive) {
      // 활성 상태에서 한 번 더 누르면 해제
      delete newHalfRequests[day];
      setActiveHalfDay(prev => ({ ...prev, [person.id]: null }));
    } else {
      // 신규 선택 시 기본값은 'middle'
      newHalfRequests[day] = 'middle';
      setActiveHalfDay(prev => ({ ...prev, [person.id]: day }));
    }

    // 하프 선택 시 동일 날짜 휴무는 제거
    const newDaysOff = person.requestedDaysOff.filter(d => d !== day);

    updatePerson(personIndex, {
      requestedDaysOff: newDaysOff,
      halfRequests: newHalfRequests
    });
  };

  const setHalfShiftForDay = (personIndex: number, day: number, shift: ShiftType) => {
    const person = people[personIndex];
    const newHalfRequests = { ...person.halfRequests, [day]: shift };
    updatePerson(personIndex, { halfRequests: newHalfRequests });
  };

  // 스케줄 생성
  const handleGenerate = () => {
    const validationErrors = validateScheduleInputs(year, month, people);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSchedule(null);
      return;
    }

    try {
      const newSchedule = generateSchedule(year, month, people);

      // 생성된 스케줄 검증(방어적)
      const generationErrors = validateGeneratedSchedule(newSchedule);
      if (generationErrors.length > 0) {
        setErrors(generationErrors);
        setSchedule(null);
        return;
      }

      setSchedule(newSchedule);
      setErrors([]);
    } catch (err) {
      if (err instanceof ScheduleGenerationError) {
        setErrors(err.errors);
        setSchedule(null);
        return;
      }
      setErrors([{ type: 'unknown', message: '스케줄 생성 중 알 수 없는 오류가 발생했습니다.' }]);
      setSchedule(null);
    }
  };

  // 스케줄 저장
  const handleSave = () => {
    if (schedule) {
      saveSchedule(schedule);
      alert('스케줄이 저장되었습니다!');
      navigate('/manage');
    }
  };

  const handleExportExcel = () => {
    if (!schedule) return;
    exportSchedulesToXlsx([schedule]);
  };

  const renderCalendar = (s: Schedule) => {
    const firstWeekday = new Date(s.year, s.month - 1, 1).getDay();
    const totalCells = firstWeekday + daysInMonth;
    const weekCount = Math.ceil(totalCells / 7);
    const cells = Array.from({ length: weekCount * 7 }, (_, i) => {
      const dayNum = i - firstWeekday + 1;
      return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null;
    });

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    return (
      <div className="calendar">
        {dayNames.map(name => (
          <div key={name} className="calendar-header">
            {name}
          </div>
        ))}
        {cells.map((dayNum, idx) => {
          if (!dayNum) {
            return <div key={`e-${idx}`} className="calendar-cell empty" />;
          }

          const assignment = s.assignments.find(a => a.date === dayNum);
          const openPeople = assignment ? assignment.people.filter(p => p.shift === 'open') : [];
          const middlePeople = assignment ? assignment.people.filter(p => p.shift === 'middle') : [];
          const closePeople = assignment ? assignment.people.filter(p => p.shift === 'close') : [];

          const dateObj = new Date(s.year, s.month - 1, dayNum);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

          return (
            <div key={dayNum} className={`calendar-cell ${isWeekend ? 'weekend' : ''}`}
            >
              <div className="calendar-date">{dayNum}</div>
              <div className="calendar-line">
                <span className="calendar-label">오픈</span>
                <span>{openPeople.map(p => p.personName).join(', ') || '-'}</span>
              </div>
              <div className="calendar-line">
                <span className="calendar-label">미들</span>
                <span>{middlePeople.map(p => p.personName).join(', ') || '-'}</span>
              </div>
              <div className="calendar-line">
                <span className="calendar-label">마감</span>
                <span>{closePeople.map(p => p.personName).join(', ') || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const yearOptions = Array.from({ length: 10 }, (_, i) => ({
    value: currentYear + i - 2,
    label: `${currentYear + i - 2}년`
  }));

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}월`
  }));

  const daysInMonth = getDaysInMonth(year, month);

  return (
    <div className="container">
      <h1>근무 스케줄 생성</h1>

      <Card title="기본 설정">
        <div className="form-row">
          <Select
            label="연도"
            value={year}
            onChange={(v) => setYear(parseInt(v))}
            options={yearOptions}
          />
          <Select
            label="월"
            value={month}
            onChange={(v) => setMonth(parseInt(v))}
            options={monthOptions}
          />
        </div>
      </Card>

      <Card title="근무 인원 설정">
        <Input
          type="number"
          label="인원 수"
          value={peopleCount}
          onChange={handlePeopleCountChange}
          min={1}
          max={20}
        />

        <div className="people-list">
          {people.map((person: Person, index: number) => (
            <div key={person.id} className="person-editor">
              <h4>인원 {index + 1}</h4>
              
              <Input
                label="이름"
                value={person.name}
                onChange={(v) => updatePerson(index, { name: v })}
                placeholder="이름 입력"
              />

              <div className="checkbox-group">
                <Checkbox
                  checked={person.canOpen}
                  onChange={(v) => updatePerson(index, { canOpen: v })}
                  label="오픈 가능"
                />
                <Checkbox
                  checked={person.canClose}
                  onChange={(v) => updatePerson(index, { canClose: v })}
                  label="마감 가능"
                />
              </div>

              <div className="checkbox-group">
                <Checkbox
                  checked={person.mustOpen}
                  onChange={(v) => updatePerson(index, { mustOpen: v })}
                  label="오픈 필수"
                />
                <Checkbox
                  checked={person.mustClose}
                  onChange={(v) => updatePerson(index, { mustClose: v })}
                  label="마감 필수"
                />
              </div>

              <div className="days-off-selector">
                <label>휴무/하프 선택</label>

                <div className="request-mode">
                  <button
                    type="button"
                    className={`request-mode-btn ${getRequestMode(person.id) === 'off' ? 'active' : ''}`}
                    onClick={() => setRequestMode(person.id, 'off')}
                  >
                    휴무
                  </button>
                  <button
                    type="button"
                    className={`request-mode-btn half ${getRequestMode(person.id) === 'half' ? 'active' : ''}`}
                    onClick={() => setRequestMode(person.id, 'half')}
                  >
                    하프
                  </button>
                </div>

                <div className="days-grid">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <button
                      key={day}
                      type="button"
                      className={`day-btn ${person.requestedDaysOff.includes(day) ? 'selected' : ''} ${person.halfRequests[day] !== undefined ? 'half-selected' : ''}`}
                      onClick={() => toggleRequestDay(index, day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {getRequestMode(person.id) === 'half' && activeHalfDay[person.id] != null && person.halfRequests[activeHalfDay[person.id] as number] !== undefined && (
                  <div className="half-shift-picker">
                    <Select
                      label={`${activeHalfDay[person.id]}일 하프 타임`}
                      value={person.halfRequests[activeHalfDay[person.id] as number]}
                      onChange={(v) => setHalfShiftForDay(index, activeHalfDay[person.id] as number, v as ShiftType)}
                      options={[
                        { value: 'open', label: '오픈' },
                        { value: 'middle', label: '미들' },
                        { value: 'close', label: '마감' }
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {errors.length > 0 && (
        <Card title="❌ 스케줄 생성 불가">
          <p style={{ marginBottom: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}>
            다음 문제를 해결한 후 다시 시도해주세요:
          </p>
          <div className="errors">
            {errors.map((error, i) => (
              <div key={i} className="error-message">
                {error.message}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="actions actions-bottom-gap">
        <Button onClick={handleGenerate} variant="primary">
          스케줄 생성
        </Button>
      </div>

      {schedule && (
        <>
          <Card title="인원별 근무 통계">
            <div className="stats-grid">
              {schedule.people.map((person: Person) => {
                const workDays = schedule.assignments.filter(day =>
                  day.people.some(p => p.personId === person.id)
                ).map(day => day.date);
                const offDays = person.requestedDaysOff;
                
                return (
                  <div key={person.id} className="person-stats">
                    <h4>{person.name}</h4>
                    <div className="stat-item">
                      <strong>근무일수:</strong>
                      <span>{workDays.length}일</span>
                    </div>
                    <div className="stat-item">
                      <strong>휴무일수:</strong>
                      <span>{offDays.length}일</span>
                    </div>
                    {offDays.length > 0 && (
                      <div className="stat-item">
                        <strong>휴무일:</strong>
                        <span>{offDays.sort((a, b) => a - b).join(', ')}일</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={`${schedule.year}년 ${schedule.month}월 스케줄`}>
          <div className="actions">
            <Button onClick={handleExportExcel} variant="secondary">
              엑셀 내보내기
            </Button>
          </div>

          <div className="calendar-wrapper">{renderCalendar(schedule)}</div>

          <div className="actions">
            <Button onClick={handleSave} variant="primary">
              저장하기
            </Button>
          </div>
        </Card>
        </>
      )}
    </div>
  );
}
