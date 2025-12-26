import { Schedule, Person, ShiftType, StaffConfig, Prep, Ingredient } from './types';
import { STORAGE_KEY, STAFF_CONFIG_KEY, PREPS_STORAGE_KEY, INGREDIENTS_STORAGE_KEY } from './constants';

function normalizePerson(raw: Person): Person {
  const canOpen = typeof raw.canOpen === 'boolean' ? raw.canOpen : true;
  const canClose = typeof raw.canClose === 'boolean' ? raw.canClose : true;
  const canMiddle = typeof (raw as Person).canMiddle === 'boolean' ? (raw as Person).canMiddle : true;

  const mustOpen = typeof raw.mustOpen === 'boolean' ? raw.mustOpen : false;
  const mustClose = typeof raw.mustClose === 'boolean' ? raw.mustClose : false;

  const requestedDaysOff = Array.isArray(raw.requestedDaysOff) ? raw.requestedDaysOff : [];
  const halfRequests = raw.halfRequests && typeof raw.halfRequests === 'object' ? raw.halfRequests : {};

  const preferredShiftRaw = (raw as Person).preferredShift as unknown;
  const preferredShift: ShiftType =
    preferredShiftRaw === 'open' || preferredShiftRaw === 'middle' || preferredShiftRaw === 'close'
      ? preferredShiftRaw
      : 'middle';

  const openPriority = typeof raw.openPriority === 'number' ? raw.openPriority : undefined;
  const middlePriority = typeof raw.middlePriority === 'number' ? raw.middlePriority : undefined;
  const closePriority = typeof raw.closePriority === 'number' ? raw.closePriority : undefined;

  return {
    ...raw,
    canOpen,
    canMiddle,
    canClose,
    mustOpen,
    mustClose,
    preferredShift,
    requestedDaysOff,
    halfRequests,
    openPriority,
    middlePriority,
    closePriority
  };
}

function normalizeStaffConfig(raw: any): StaffConfig {
  const id = typeof raw?.id === 'string' ? raw.id : String(Math.random()).slice(2);
  const name = typeof raw?.name === 'string' ? raw.name : 'Unnamed';
  const canOpen = typeof raw?.canOpen === 'boolean' ? raw.canOpen : true;
  const canMiddle = typeof raw?.canMiddle === 'boolean' ? raw.canMiddle : true;
  const canClose = typeof raw?.canClose === 'boolean' ? raw.canClose : true;
  const mustOpen = typeof raw?.mustOpen === 'boolean' ? raw.mustOpen : undefined;
  const mustClose = typeof raw?.mustClose === 'boolean' ? raw.mustClose : undefined;
  const preferredShift = raw?.preferredShift === 'open' || raw?.preferredShift === 'middle' || raw?.preferredShift === 'close' ? raw.preferredShift : null;
  const openPriority = typeof raw?.openPriority === 'number' ? raw.openPriority : undefined;
  const middlePriority = typeof raw?.middlePriority === 'number' ? raw.middlePriority : undefined;
  const closePriority = typeof raw?.closePriority === 'number' ? raw.closePriority : undefined;

  return {
    id,
    name,
    canOpen,
    canMiddle,
    canClose,
    mustOpen,
    mustClose,
    preferredShift,
    openPriority,
    middlePriority,
    closePriority
  };
}

function normalizeSchedule(raw: Schedule): Schedule {
  const people = Array.isArray(raw.people) ? raw.people.map(normalizePerson) : [];
  const dailyStaffByDate = raw.dailyStaffByDate && typeof raw.dailyStaffByDate === 'object' ? raw.dailyStaffByDate : undefined;
  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];

  return {
    ...raw,
    people,
    dailyStaffByDate,
    assignments
  };
}

export function saveSchedule(schedule: Schedule): void {
  const schedules = loadSchedules();
  const existingIndex = schedules.findIndex(s => s.id === schedule.id);
  
  if (existingIndex >= 0) {
    schedules[existingIndex] = { ...schedule, updatedAt: new Date().toISOString() };
  } else {
    schedules.push(schedule);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function loadSchedules(): Schedule[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Schedule[];
    return Array.isArray(parsed) ? parsed.map(normalizeSchedule) : [];
  } catch {
    return [];
  }
}

export function deleteSchedule(id: string): void {
  const schedules = loadSchedules().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function getScheduleById(id: string): Schedule | undefined {
  const schedules = loadSchedules();
  return schedules.find(s => s.id === id);
}

// --- StaffConfig storage (global staff composition) ---
export function saveStaffConfig(config: StaffConfig[]): void {
  try {
    const normalized = Array.isArray(config) ? config.map(c => normalizeStaffConfig(c)) : [];
    localStorage.setItem(STAFF_CONFIG_KEY, JSON.stringify(normalized));
  } catch (e) {
    // ignore
  }
}

export function loadStaffConfig(): StaffConfig[] {
  const data = localStorage.getItem(STAFF_CONFIG_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as any[];
    return Array.isArray(parsed) ? parsed.map(normalizeStaffConfig) : [];
  } catch {
    return [];
  }
}

export function deleteStaffConfig(): void {
  localStorage.removeItem(STAFF_CONFIG_KEY);
}

// Helper for potential migration from existing schedules to staff config.
// Intentionally left inactive to avoid accidental automatic migration.
export function migrateStaffFromSchedules(): StaffConfig[] {
  const schedules = loadSchedules();
  // Example helper: extract unique people across schedules
  const map: Record<string, StaffConfig> = {};
  schedules.forEach(s => {
    s.people.forEach(p => {
      if (!map[p.id]) {
        map[p.id] = {
          id: p.id,
          name: p.name,
          canOpen: p.canOpen,
          canMiddle: p.canMiddle,
          canClose: p.canClose,
          mustOpen: p.mustOpen || undefined,
          mustClose: p.mustClose || undefined,
          preferredShift: p.preferredShift || null
        };
      }
    });
  });
  return Object.values(map);
}

// --- Prep storage ---
export function loadPreps(): Prep[] {
  const data = localStorage.getItem(PREPS_STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Prep[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreps(preps: Prep[]): void {
  localStorage.setItem(PREPS_STORAGE_KEY, JSON.stringify(preps));
}

export function deletePrep(id: string): void {
  const preps = loadPreps().filter(p => p.id !== id);
  savePreps(preps);
}

// --- Ingredient storage ---
export function loadIngredients(): Ingredient[] {
  const data = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Ingredient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIngredients(ingredients: Ingredient[]): void {
  localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(ingredients));
}

export function deleteIngredient(id: string): void {
  const ingredients = loadIngredients().filter(i => i.id !== id);
  saveIngredients(ingredients);
}

// --- Helpers for preview/apply workflow ---
export function upsertIngredient(ing: Ingredient): { type: 'created' | 'updated'; id: string } {
  const ingredients = loadIngredients();
  const idx = ingredients.findIndex(i => i.id === ing.id || i.name.toLowerCase() === ing.name.toLowerCase());
  if (idx >= 0) {
    ingredients[idx] = { ...ingredients[idx], ...ing };
    saveIngredients(ingredients);
    return { type: 'updated', id: ingredients[idx].id };
  }
  const newId = ing.id || String(Date.now());
  const newIng = { ...ing, id: newId };
  ingredients.push(newIng);
  saveIngredients(ingredients);
  return { type: 'created', id: newId };
}

// previewItems: CsvPreviewItem[], actions: Record<rowNumber, CsvAction>
export function applyPreviewActionsForIngredients(previewItems: any[], actions: Record<number, string>) {
  const results = { created: 0, updated: 0, skipped: 0 };
  const ingredients = loadIngredients();

  previewItems.forEach((item: any) => {
    const act = actions[item.rowNumber] as string;
    if (act === 'skip') { results.skipped += 1; return; }

    const parsed = item.parsed || {};
    const name = String(parsed.name || '').trim();
    const price = Number(parsed.price || 0) || 0;
    const purchaseUnit = Number(parsed.purchaseUnit || 1) || 1;
    const unitPrice = purchaseUnit > 0 ? price / purchaseUnit : 0;

    if (!name) { results.skipped += 1; return; }

    if (act === 'create') {
      const id = String(Date.now()) + String(Math.random()).slice(2,8);
      ingredients.push({ id, name, price, purchaseUnit, unitPrice });
      results.created += 1;
      return;
    }

    // update or merge: try find existing by detected id or name (case-insensitive)
    let existing: Ingredient | undefined;
    if (item.detectedMatch && item.detectedMatch.id) {
      existing = ingredients.find(i => i.id === item.detectedMatch.id);
    }
    if (!existing) existing = ingredients.find(i => i.name.toLowerCase() === (name || '').toLowerCase());

    if (!existing) {
      // no existing -> create
      const id = String(Date.now()) + String(Math.random()).slice(2,8);
      ingredients.push({ id, name, price, purchaseUnit, unitPrice });
      results.created += 1;
      return;
    }

    if (act === 'update') {
      existing.name = name || existing.name;
      existing.price = price;
      existing.purchaseUnit = purchaseUnit;
      existing.unitPrice = unitPrice;
      results.updated += 1;
      return;
    }

    if (act === 'merge') {
      // merge rules: prefer non-empty file values; for numbers prefer >0
      existing.name = name || existing.name;
      existing.price = price > 0 ? price : existing.price;
      existing.purchaseUnit = purchaseUnit > 0 ? purchaseUnit : existing.purchaseUnit;
      existing.unitPrice = existing.purchaseUnit > 0 ? existing.price / existing.purchaseUnit : existing.unitPrice;
      results.updated += 1;
      return;
    }
  });

  saveIngredients(ingredients);
  return results;
}

// Apply preview actions for Prep CSV preview items.
// previewItems: each item.parsed should contain prepName, ingredientName, quantity, replenishDates
export function applyPreviewActionsForPreps(previewItems: any[], actions: Record<number, string>) {
  const existingPreps = loadPreps();
  const ingredients = loadIngredients();
  const ingredientNameMap: Record<string, string> = {};
  ingredients.forEach(i => { ingredientNameMap[i.name.toLowerCase()] = i.id; });

  const prepMap = new Map<string, { id: string; name: string; ingredients: any[]; replenishSet: Set<string>; createdAt: string; updatedAt: string }>();

  previewItems.forEach((item: any) => {
    const act = actions[item.rowNumber] as string;
    if (act === 'skip') return;
    const parsed = item.parsed || {};
    const prepName = String(parsed.prepName || parsed.name || '').trim();
    const ingredientName = String(parsed.ingredientName || '').trim();
    const quantity = Number(parsed.quantity || 0) || 0;
    const replenishDates = Array.isArray(parsed.replenishDates) ? parsed.replenishDates : (parsed.replenishDates ? [parsed.replenishDates] : []);
    if (!prepName || !ingredientName) return;

    // ensure ingredient exists
    let ingredientId = ingredientNameMap[ingredientName.toLowerCase()];
    if (!ingredientId) {
      const newId = String(Date.now()) + String(Math.random()).slice(2,8);
      const newIng = { id: newId, name: ingredientName, price: 0, purchaseUnit: 1, unitPrice: 0 };
      ingredients.push(newIng);
      ingredientId = newId;
      ingredientNameMap[ingredientName.toLowerCase()] = newId;
    }

    let entry = prepMap.get(prepName);
    if (!entry) {
      entry = { id: String(Date.now()) + String(Math.random()).slice(2,6), name: prepName, ingredients: [], replenishSet: new Set<string>(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      prepMap.set(prepName, entry);
    }

    const existingPi = entry.ingredients.find((pi: any) => pi.ingredientId === ingredientId);
    if (existingPi) existingPi.quantity = (existingPi.quantity || 0) + quantity; else entry.ingredients.push({ ingredientId, ingredientName, quantity });
    replenishDates.forEach((d: string) => { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) entry!.replenishSet.add(d); });
  });

  // merge with existing preps: if same name exists, append ingredients and dedupe
  const newPreps: any[] = [];
  const existingNameIndex: Record<string, number> = {};
  existingPreps.forEach((p, i) => { existingNameIndex[p.name.toLowerCase()] = i; });

  prepMap.forEach(p => {
    const replenishHistory = Array.from(p.replenishSet).sort();
    const existingIdx = existingNameIndex[p.name.toLowerCase()];
    if (existingIdx >= 0) {
      const target = existingPreps[existingIdx];
      // merge ingredients (sum quantities)
      p.ingredients.forEach((pi: any) => {
        const ex = target.ingredients.find((e: any) => e.ingredientId === pi.ingredientId);
        if (ex) ex.quantity = (ex.quantity || 0) + pi.quantity; else target.ingredients.push(pi);
      });
      target.replenishHistory = Array.from(new Set([...(target.replenishHistory||[]), ...replenishHistory])).sort();
      target.updatedAt = new Date().toISOString();
    } else {
      // new prep
      const totalCost = 0; // will be recalculated by caller if needed
      newPreps.push({ id: p.id, name: p.name, ingredients: p.ingredients, replenishHistory, nextReplenishDate: undefined, totalCost, createdAt: p.createdAt, updatedAt: p.updatedAt });
    }
  });

  // save updated ingredients and preps
  saveIngredients(ingredients);
  savePreps([...existingPreps, ...newPreps]);
  return { created: newPreps.length, updated: 0 };
}
