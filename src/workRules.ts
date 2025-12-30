export function getWorkRules() {
  return {
    DAILY_STAFF_BASE: 2,
    DAILY_STAFF_MAX: 10,
    WORK_HOURS: 8,
    BREAK_HOURS: 1,
    SHIFT_PRIORITY: {
      1: ['open', 'close'],
      2: ['open', 'close', 'middle'],
      3: ['open', 'middle', 'close']
    }
  };
}

export default getWorkRules;
