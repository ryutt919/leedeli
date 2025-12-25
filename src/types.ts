// 근무 타입
export type ShiftType = 'open' | 'middle' | 'close';

// 인원 정보
export interface Person {
  id: string;
  name: string;
  canOpen: boolean;
  canMiddle: boolean;
  canClose: boolean;
  mustOpen: boolean;
  mustClose: boolean;
  preferredShift: ShiftType;
  openPriority?: number;  // 오픈 우선순위 (1~총직원수)
  middlePriority?: number;  // 미들 우선순위 (1~총직원수)
  closePriority?: number;  // 마감 우선순위 (1~총직원수)
  requestedDaysOff: number[];
  halfRequests: Record<number, ShiftType>;
}

// 날짜별 배정
export interface DayAssignment {
  date: number;
  people: {
    personId: string;
    personName: string;
    shift: ShiftType;
    isHalf?: boolean;
  }[];
}

// 스케줄
export interface Schedule {
  id: string;
  year: number;
  month: number;
  people: Person[];
  dailyStaffByDate?: Record<number, number>;
  assignments: DayAssignment[];
  createdAt: string;
  updatedAt: string;
}

// 검증 오류
export interface ValidationError {
  type: string;
  message: string;
}

// 전역 직원 구성(스케줄과 별개)
export interface StaffConfig {
  id: string;
  name: string;
  canOpen: boolean;
  canMiddle: boolean;
  canClose: boolean;
  mustOpen?: boolean;
  mustClose?: boolean;
  preferredShift?: ShiftType | null;
  openPriority?: number;
  middlePriority?: number;
  closePriority?: number;
}

// 재료
export interface Ingredient {
  id: string;
  name: string;
  price: number; // 구매 가격
  purchaseUnit: number; // 구매 단위 (예: 1kg, 500g 등)
  unitPrice: number; // 단위 가격 (price / purchaseUnit)
}

// 프렙 재료 (프렙에 사용되는 재료와 수량)
export interface PrepIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number; // 사용량
}

// 프렙
export interface Prep {
  id: string;
  name: string;
  ingredients: PrepIngredient[]; // 재료 목록
  nextReplenishDate?: string; // 다음 보충 예상 날짜 (YYYY-MM-DD) - 계산된 값
  replenishHistory: string[]; // 보충 이력 (YYYY-MM-DD 형식의 날짜 배열, 오름차순 정렬)
  totalCost: number; // 프렙 총 재료 비용
  createdAt: string;
  updatedAt: string;
}