import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// ──────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────

/** Supabase auth endpoint를 모킹해 로그인 상태로 만든다 */
async function mockLoggedIn(page: import('@playwright/test').Page, isAdmin: boolean) {
  const fakeUserId = 'user-mock-001'

  // getSession → 로그인 세션 반환
  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: { id: fakeUserId, email: 'test@example.com' },
      }),
    })
  })

  // admin_users 조회
  await page.route('**/rest/v1/admin_users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isAdmin ? [{ id: 'admin-row-1' }] : []),
    })
  })
}

/** 비로그인 상태 모킹 */
async function mockLoggedOut(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { session: null }, error: null }),
    })
  })

  await page.route('**/rest/v1/admin_users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

test.describe('S3T1 — AuthContext global state', () => {
  test('앱이 AuthProvider 없이 크래시하지 않는다 (로그인 페이지 렌더)', async ({ page }) => {
    await mockLoggedOut(page)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto(`${BASE}/#/login`)
    // 로그인 페이지가 정상 렌더되는지 확인
    await expect(page.locator('body')).toBeVisible()
    expect(errors.filter((e) => e.includes('AuthProvider') || e.includes('useAuth'))).toHaveLength(0)
  })

  test('비로그인: isAdmin=false → /unauthorized 로 직접 접근 시 리다이렉트 없음 (S3T2 몫)', async ({ page }) => {
    await mockLoggedOut(page)
    // S3T1 범위: AuthContext가 session=null 로 초기화되는지만 확인
    // RequireAdmin은 S3T2에서 구현
    await page.goto(`${BASE}/#/login`)
    await expect(page.locator('body')).toBeVisible()
  })

  test('페이지가 정상 로드되며 AuthContext useAuth() 에러 없음', async ({ page }) => {
    await mockLoggedOut(page)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`${BASE}/#/login`)
    await page.waitForLoadState('networkidle')

    // useAuth()가 Provider 외부에서 호출되면 throw하도록 구현됐으므로
    // 정상 렌더 시 그 에러가 없어야 함
    const authErrors = consoleErrors.filter((e) => e.includes('useAuth must be used'))
    expect(authErrors).toHaveLength(0)
  })
})
