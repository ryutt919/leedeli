import type { Employee } from '../domain/types'

export function compareEmployeesByRole(a: Employee, b: Employee): number {
  if (a.role !== b.role) return a.role === '정직원' ? -1 : 1
  return a.name.localeCompare(b.name)
}
