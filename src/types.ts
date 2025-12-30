export type ShiftType = 'open' | 'middle' | 'close';

export interface Person {
  id: string;
  name: string;
  requestedDaysOff: number[];
  halfRequests?: Record<string, ShiftType>;
  canOpen?: boolean;
  canMiddle?: boolean;
  canClose?: boolean;
  preferredShift?: ShiftType;
  openPriority?: number;
  middlePriority?: number;
  closePriority?: number;
  mustOpen?: boolean;
  mustClose?: boolean;
}

export interface DayPersonAssignment {
  personId: string;
  personName?: string;
  shift: ShiftType;
  isHalf?: boolean;
}

export interface DayAssignment {
  date: number;
  people: DayPersonAssignment[];
}

export interface Schedule {
  id: string;
  year: number;
  month: number;
  people: Person[];
  dailyStaffByDate?: Record<number, number>;
  assignments: DayAssignment[];
  createdAt?: string;
  updatedAt?: string;
}

export type ValidationError = {
  type: string;
  message: string;
};

export type Prep = any;
export type Ingredient = any;

export default {} as any;
