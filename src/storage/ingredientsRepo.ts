import type { Ingredient } from '../domain/types'
import { supabase } from '../utils/supabase'

type DbRow = {
  id: string
  name: string
  purchase_price: number
  purchase_unit: number
  unit_price: number
  unit_label: string | null
  updated_at: string
  category: string | null
}

function rowToIngredient(row: DbRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    purchasePrice: Number(row.purchase_price),
    purchaseUnit: Number(row.purchase_unit),
    unitPrice: Number(row.unit_price),
    unitLabel: row.unit_label ?? 'g',
    updatedAtISO: row.updated_at,
    category: row.category ?? undefined,
  }
}

function ingredientToRow(it: Ingredient): DbRow {
  return {
    id: it.id,
    name: it.name,
    purchase_price: it.purchasePrice,
    purchase_unit: it.purchaseUnit,
    unit_price: it.unitPrice,
    unit_label: it.unitLabel ?? 'g',
    updated_at: it.updatedAtISO,
    category: it.category ?? null,
  }
}

export async function loadIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, purchase_price, purchase_unit, unit_price, unit_label, updated_at, category')
    .order('name')
  if (error) {
    console.error('[ingredientsRepo] loadIngredients', error)
    return []
  }
  return (data as unknown as DbRow[]).map(rowToIngredient)
}

export async function upsertIngredient(next: Ingredient): Promise<void> {
  const { error } = await supabase
    .from('ingredients')
    .upsert(ingredientToRow(next), { onConflict: 'id' })
  if (error) {
    console.error('[ingredientsRepo] upsertIngredient', error)
    throw error
  }
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) {
    console.error('[ingredientsRepo] deleteIngredient', error)
    throw error
  }
}

export async function saveIngredients(items: Ingredient[]): Promise<void> {
  if (items.length === 0) return
  const { error } = await supabase
    .from('ingredients')
    .upsert(items.map(ingredientToRow), { onConflict: 'id' })
  if (error) {
    console.error('[ingredientsRepo] saveIngredients', error)
    throw error
  }
}

export async function clearIngredients(): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().neq('id', '')
  if (error) {
    console.error('[ingredientsRepo] clearIngredients', error)
    throw error
  }
}
