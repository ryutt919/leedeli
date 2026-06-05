import type { Ingredient, MenuItem, Prep } from '../domain/types'

export function calcPrepCalories(
  prep: Prep,
  ingredientById: Map<string, Ingredient>
): number {
  let total = 0
  for (const item of prep.items) {
    const ing = ingredientById.get(item.ingredientId)
    if (!ing?.caloriesPer100g) continue
    const unit = ing.unitLabel ?? (ing.unitType === 'ea' ? '개' : 'g')
    const isWeightVolume = unit === 'g' || unit === 'ml'
    total += isWeightVolume
      ? (ing.caloriesPer100g * item.amount) / 100
      : ing.caloriesPer100g * item.amount
  }
  return Math.round(total)
}

export function calcMenuCalories(
  menu: MenuItem,
  ingredientById: Map<string, Ingredient>,
  prepById: Map<string, Prep>
): number {
  let total = 0
  for (const item of menu.ingredientItems) {
    const ing = ingredientById.get(item.ingredientId)
    if (!ing?.caloriesPer100g) continue
    const unit = ing.unitLabel ?? (ing.unitType === 'ea' ? '개' : 'g')
    const isWeightVolume = unit === 'g' || unit === 'ml'
    total += isWeightVolume
      ? (ing.caloriesPer100g * item.amount) / 100
      : ing.caloriesPer100g * item.amount
  }
  for (const pt of menu.prepItems) {
    const prep = prepById.get(pt.prepId)
    if (!prep?.yieldAmount || prep.yieldAmount <= 0) continue
    const prepCals = calcPrepCalories(prep, ingredientById)
    if (prepCals === 0) continue
    total += (prepCals * pt.amount) / prep.yieldAmount
  }
  return Math.round(total)
}
