import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

const MOCK_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiJ1c2VyLW1vY2stMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ' +
  '.fake-sig'

const FAKE_USER_ID = 'user-mock-001'

async function mockLoggedIn(page: import('@playwright/test').Page, isAdmin: boolean) {
  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: MOCK_JWT,
        token_type: 'bearer',
        expires_in: 9999999999,
        refresh_token: 'mock-refresh-token',
        user: { id: FAKE_USER_ID, email: 'test@example.com' },
      }),
    })
  })

  await page.route('**/rest/v1/admin_users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isAdmin ? [{ id: 'admin-row-1', user_id: FAKE_USER_ID, granted_at: '2026-01-01T00:00:00Z', granted_by: null, revoked_at: null }] : []),
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

/** 관리자로 로그인 후 BottomNav "유저" 탭이 나타날 때까지 기다려 auth 정착 보장 */
async function signInAsAdmin(page: import('@playwright/test').Page) {
  await signIn(page)
  await expect(page.getByRole('button', { name: '유저' })).toBeVisible({ timeout: 15000 })
}

// ──────────────────────────────────────────────
// TC1: 비관리자 /users 접근 차단
// ──────────────────────────────────────────────

test.describe('S12T2 TC1 — 비관리자 /users 접근 차단', () => {
  test('비관리자가 /users 접근 시 /unauthorized 로 리다이렉트된다', async ({ page }) => {
    await mockLoggedIn(page, false)
    await signIn(page)

    await page.goto(`${BASE}/#/users`)
    await expect(page).toHaveURL(/#\/unauthorized$/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /권한 없음/ })).toBeVisible()
  })
})

// ──────────────────────────────────────────────
// TC2: 관리자 /users 접근 허용
// ──────────────────────────────────────────────

test.describe('S12T2 TC2 — 관리자 /users 접근 허용', () => {
  test('관리자가 /users 에 접근하면 유저 관리 페이지가 렌더된다', async ({ page }) => {
    await mockLoggedIn(page, true)
    await signInAsAdmin(page)

    await page.getByRole('button', { name: '유저' }).click()
    await expect(page).toHaveURL(/#\/users$/, { timeout: 10000 })
    await expect(page.getByText('유저 관리')).toBeVisible({ timeout: 10000 })
  })
})

// ──────────────────────────────────────────────
// TC3: 관리자 목록 렌더링
// ──────────────────────────────────────────────

test.describe('S12T2 TC3 — 관리자 목록 렌더링', () => {
  test('관리자 목록이 페이지에 표시된다', async ({ page }) => {
    await mockLoggedIn(page, true)
    await signInAsAdmin(page)

    await page.getByRole('button', { name: '유저' }).click()
    await expect(page.getByText('현재 관리자 목록')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(FAKE_USER_ID)).toBeVisible({ timeout: 10000 })
  })
})

// ──────────────────────────────────────────────
// TC4: 승격 성공 메시지
// ──────────────────────────────────────────────

test.describe('S12T2 TC4 — 승격 성공 메시지', () => {
  test('이메일 입력 후 승격 시 성공 메시지가 표시된다', async ({ page }) => {
    await mockLoggedIn(page, true)

    await page.route('**/rest/v1/rpc/get_user_id_by_email*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('target-user-id-001'),
      })
    })

    await page.route('**/rest/v1/admin_users', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.continue()
      }
    })

    await signInAsAdmin(page)
    await page.getByRole('button', { name: '유저' }).click()
    await expect(page.getByPlaceholder('이메일 주소 입력')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('이메일 주소 입력').fill('new-admin@example.com')
    await page.getByRole('button', { name: '승격' }).click()

    await expect(page.getByText(/관리자 권한을 부여했습니다/)).toBeVisible({ timeout: 10000 })
  })
})

// ──────────────────────────────────────────────
// TC5: 존재하지 않는 이메일 에러 메시지
// ──────────────────────────────────────────────

test.describe('S12T2 TC5 — 존재하지 않는 이메일 에러', () => {
  test('존재하지 않는 이메일 입력 시 에러 메시지가 표시된다', async ({ page }) => {
    await mockLoggedIn(page, true)

    await page.route('**/rest/v1/rpc/get_user_id_by_email*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await signInAsAdmin(page)
    await page.getByRole('button', { name: '유저' }).click()
    await expect(page.getByPlaceholder('이메일 주소 입력')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('이메일 주소 입력').fill('nonexistent@example.com')
    await page.getByRole('button', { name: '승격' }).click()

    await expect(page.getByText(/사용자를 찾을 수 없습니다/)).toBeVisible({ timeout: 10000 })
  })
})

// ──────────────────────────────────────────────
// TC6: BottomNav 관리자 전용 탭 조건부 표시
// ──────────────────────────────────────────────

test.describe('S12T2 TC6 — BottomNav 관리자 전용 탭', () => {
  test('관리자에게는 유저 탭이 표시된다', async ({ page }) => {
    await mockLoggedIn(page, true)
    await signIn(page)

    await expect(page.getByRole('button', { name: '유저' })).toBeVisible({ timeout: 15000 })
  })

  test('비관리자에게는 유저 탭이 표시되지 않는다', async ({ page }) => {
    await mockLoggedIn(page, false)
    await signIn(page)

    await expect(page.getByRole('button', { name: '유저' })).not.toBeVisible({ timeout: 5000 })
  })
})
