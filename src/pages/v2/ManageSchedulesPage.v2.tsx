import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/v2/Card';
import { Button } from '../../components/v2/Button';
import { Input } from '../../components/v2/Input';
import type { Person, Schedule, DayAssignment } from '../../v2/types';
import { loadSchedules, deleteSchedule } from '../../v2/storage';
import { exportSchedulesToXlsx } from '../../v2/generator';
import { getDaysInMonth } from '../../v2/validator';
import '../../v2/v2-style.css';

export function ManageSchedulesPageV2() {
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
        const filteredSchedules = getFilteredSchedules();
        if (filteredSchedules.length === 0) {
            alert('내보낼 스케줄이 없습니다.');
            return;
        }
        exportSchedulesToXlsx(filteredSchedules);
    };

    const renderCalendar = (s: Schedule) => {
        const dInM = getDaysInMonth(s.year, s.month);
        const firstWeekday = new Date(s.year, s.month - 1, 1).getDay();
        const totalCells = firstWeekday + dInM;
        const weekCount = Math.ceil(totalCells / 7);
        const cells = Array.from({ length: weekCount * 7 }, (_, i) => {
            const dayNum = i - firstWeekday + 1;
            return dayNum >= 1 && dayNum <= dInM ? dayNum : null;
        });

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        return (
            <div className="calendar">
                {dayNames.map((name: string) => (
                    <div key={name} className="calendar-header">
                        {name}
                    </div>
                ))}

                {cells.map((dayNum: number | null, idx: number) => {
                    if (!dayNum) {
                        return <div key={`e-${idx}`} className="calendar-cell empty" />;
                    }

                    const assignment = s.assignments.find(a => a.date === dayNum);
                    const openPeople = assignment ? assignment.people.filter((p: any) => p.shift === 'open') : [];
                    const middlePeople = assignment ? assignment.people.filter((p: any) => p.shift === 'middle') : [];
                    const closePeople = assignment ? assignment.people.filter((p: any) => p.shift === 'close') : [];

                    const formatAssignedName = (personName: string, isHalf?: boolean) => (isHalf ? `${personName}(하프)` : personName);

                    const dateObj = new Date(s.year, s.month - 1, dayNum);
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                    return (
                        <div key={dayNum} className={`calendar-cell ${isWeekend ? 'weekend' : ''}`}>
                            <div className="calendar-date">{dayNum}</div>
                            <div className="calendar-line">
                                <span className="calendar-label">오픈</span>
                                <span>{openPeople.map((p: any) => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}</span>
                            </div>
                            <div className="calendar-line">
                                <span className="calendar-label">미들</span>
                                <span>{middlePeople.map((p: any) => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}</span>
                            </div>
                            <div className="calendar-line">
                                <span className="calendar-label">마감</span>
                                <span>{closePeople.map((p: any) => formatAssignedName(p.personName, p.isHalf)).join(', ') || '-'}</span>
                            </div>
                        </div>
                    );
                })}
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
        <div className="container">
            <style>{`
                .title-modern {
                    font-size: 24px;
                    font-weight: 700;
                    color: #333;
                    padding-bottom: 10px;
                    border-bottom: 3px solid #4A90E2; /* 포인트 컬러 파란색 */
                    display: inline-block; /* 밑줄이 글자 길이만큼만 생기게 함 */
                    letter-spacing: -0.5px; /* 글자 간격을 좁혀 세련되게 */
                }
            `}</style>
            <h1 className="title-modern">스케줄 관리/조회</h1>

            <Card title="필터">
                <div className="form-row">
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
                <div className="actions">
                    <Button onClick={handleExport} variant="secondary">
                        엑셀 내보내기
                    </Button>
                </div>
            </Card>

            {filtered.length === 0 ? (
                <Card>
                    <p className="empty-message">저장된 스케줄이 없습니다.</p>
                    <Button onClick={() => navigate('/create')}>
                        새 스케줄 만들기
                    </Button>
                </Card>
            ) : (
                <div className="schedules-list">
                    {filtered.map(schedule => (
                        <Card key={schedule.id} title={`${schedule.year}년 ${schedule.month}월`}>
                            <div className="schedule-summary">
                                <div className="summary-item">
                                    <strong>근무 인원:</strong>
                                    <span>{schedule.people.map((p: Person) => p.name).join(', ')}</span>
                                </div>
                                <div className="summary-item">
                                    <strong>생성일:</strong>
                                    <span>{new Date(schedule.createdAt).toLocaleDateString('ko-KR')}</span>
                                </div>
                                <div className="summary-item">
                                    <strong>수정일:</strong>
                                    <span>{new Date(schedule.updatedAt).toLocaleDateString('ko-KR')}</span>
                                </div>
                            </div>

                            <h4 className="subsection-title">인원별 근무 통계</h4>
                            <div className="stats-grid">
                                {schedule.people.map((person: Person) => {
                                    const fullWorkDays = schedule.assignments
                                        .filter((day: DayAssignment) => day.people.some(p => p.personId === person.id && !p.isHalf))
                                        .map((day: DayAssignment) => day.date);

                                    const halfDays = schedule.assignments
                                        .filter((day: DayAssignment) => day.people.some(p => p.personId === person.id && !!p.isHalf))
                                        .map((day: DayAssignment) => day.date);

                                    const workEquivalent = fullWorkDays.length + halfDays.length * 0.5;
                                    const offDays = person.requestedDaysOff;
                                    const offEquivalent = offDays.length + halfDays.length * 0.5;

                                    return (
                                        <div key={person.id} className="person-stats">
                                            <h4>{person.name}</h4>
                                            <div className="stat-item">
                                                <strong>근무(환산):</strong>
                                                <span>{workEquivalent}일</span>
                                            </div>
                                            <div className="stat-item">
                                                <strong>하프:</strong>
                                                <span>{halfDays.length}일</span>
                                            </div>
                                            <div className="stat-item">
                                                <strong>휴무(환산):</strong>
                                                <span>{offEquivalent}일</span>
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

                            <h4 className="subsection-title">달력 전체 보기</h4>
                            <div className="calendar-wrapper">{renderCalendar(schedule)}</div>

                            <div className="actions">
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
