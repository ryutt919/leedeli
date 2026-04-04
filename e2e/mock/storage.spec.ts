import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// ──────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────

async function mockAuthAndAdmin(page: import('@playwright/test').Page) {
  const fakeUserId = 'user-mock-001'

  // exp=9999999999인 JWT → Supabase JS가 refresh 시도하지 않아 re-render 안정화
  const mockJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiJ1c2VyLW1vY2stMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ' +
    '.fake-sig'

  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: mockJwt,
        token_type: 'bearer',
        expires_in: 9999999999,
        refresh_token: 'mock-refresh-token',
        user: { id: fakeUserId, email: 'test@example.com' },
      }),
    })
  })

  await page.route('**/rest/v1/admin_users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'admin-row-1' }]),
    })
  })
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/#/login`)
  await page.getByPlaceholder('email@example.com').fill('test@example.com')
  await page.locator('input[type="password"]').fill('password123')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/#\/$/)
}

// ──────────────────────────────────────────────
// S4T1 — IngredientsPage render check
// ──────────────────────────────────────────────

test.describe('S4T1 — IngredientsPage render', () => {
  test('재료 관리 페이지가 정상 렌더된다', async ({ page }) => {
    await mockAuthAndAdmin(page)
    // ingredients 조회 mock
    await page.route('**/rest/v1/ingredients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await signIn(page)
    // 홈 페이지 링크 클릭 (hash-change, full reload 없음 → Supabase 재초기화 없음 → DOM stable)
    await expect(page.getByRole('link', { name: '재료' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: '재료' }).click()
    // 페이지 타이틀 확인
    await expect(page.getByText('재료 관리')).toBeVisible({ timeout: 10000 })
    // 추가 버튼 확인
    await expect(page.getByRole('button', { name: '추가' })).toBeVisible()
  })
})

// ──────────────────────────────────────────────
// S4T2 — PrepsPage (Supabase prepsRepo)
// ──────────────────────────────────────────────

test.describe('S4T2 — PrepsPage Supabase prepsRepo', () => {
  const mockPrep = {
    id: 'prep-uuid-001',
    data: {
      id: 'prep-uuid-001',
      name: '토마토 소스',
      items: [],
      restockDatesISO: [],
      updatedAtISO: '2026-04-01T00:00:00.000Z',
    },
  }

  test('PrepsPage가 정상 렌더되고 Supabase 데이터를 표시한다', async ({ page }) => {
    await mockAuthAndAdmin(page)

    // preps 목록 조회 mock
    await page.route('**/rest/v1/preps*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockPrep]),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    // ingredients mock (PrepsPage도 ingredients 로드)
    await page.route('**/rest/v1/ingredients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await signIn(page)
    // 홈 페이지 링크 클릭 (hash-change, full reload 없음 → DOM stable)
    await expect(page.getByRole('link', { name: '프렙/소스' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: '프렙/소스' }).click()
    // 페이지 타이틀
    await expect(page.getByText('프렙/소스 관리')).toBeVisible({ timeout: 10000 })
    // 추가 버튼 (per-item "오늘 추가" 버튼과 구분하기 위해 first() 사용)
    await expect(page.getByRole('button', { name: '추가' }).first()).toBeVisible()
    // Supabase에서 로드된 프렙 항목 (async useEffect 완료 대기)
    await expect(page.getByText('토마토 소스')).toBeVisible({ timeout: 10000 })
  })

  test('프렙 추가 버튼 클릭 시 모달이 열린다', async ({ page }) => {
    await mockAuthAndAdmin(page)

    await page.route('**/rest/v1/preps*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/ingredients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await signIn(page)
    // 홈 페이지 링크 클릭 (hash-change, full reload 없음 → DOM stable)
    await expect(page.getByRole('link', { name: '프렙/소스' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: '프렙/소스' }).click()
    await expect(page.getByRole('button', { name: '추가' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '추가' }).click()
    // 모달 열림 확인
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('프렙 upsert 시 Supabase REST API가 호출된다', async ({ page }) => {
    await mockAuthAndAdmin(page)

    let upsertCalled = false

    await page.route('**/rest/v1/preps*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (method === 'POST') {
        upsertCalled = true
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    await page.route('**/rest/v1/ingredients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await signIn(page)
    // 홈 페이지 링크 클릭 (hash-change, full reload 없음 → DOM stable)
    await expect(page.getByRole('link', { name: '프렙/소스' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: '프렙/소스' }).click()
    await expect(page.getByRole('button', { name: '추가' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '추가' }).click()
    await page.getByRole('dialog').getByLabel('이름').fill('새 프렙')

    const responsePromise = page.waitForResponse('**/rest/v1/preps*')
    await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
    await responsePromise

    // Supabase POST 호출 확인
    expect(upsertCalled).toBe(true)
  })
})
