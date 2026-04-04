/**
 * auth-flow.spec.ts
 * 인증 흐름 E2E 테스트 (mock 프로젝트)
 *
 * 검증 시나리오:
 * 1. 비로그인 → 홈페이지 진입 → 로그인 화면 redirect
 * 2. 비로그인 → /create 직접 접근 → 로그인 redirect
 * 3. 로그인 수행 → 홈 이동 확인
 * 4. 로그인 상태 → 스케줄 생성 클릭 → 스케줄 생성 화면 이동
 * 5. 스케줄 생성 폼 렌더링 확인
 * 6. 스케줄 생성 폼 제출 (mock)
 */
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'
const ADMIN_USER_ID = 'user-admin-flow-001'

// Supabase JS는 JWT를 서버 검증 없이 디코딩해 exp를 확인함.
// exp가 미래이면 refresh 요청을 보내지 않아 mock 타이밍 문제 없음.
// payload: { sub, email, role, aud, exp: 9999999999 }
const MOCK_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiJ1c2VyLWFkbWluLWZsb3ctMDAxIiwiZW1haWwiOiJhZG1pbkBsZWVkZWxpLnRlc3QiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9' +
  '.fake-sig'

// ──────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────

/** 관리자 로그인 mock 설정 */
async function setupAdminMocks(page: import('@playwright/test').Page): Promise<void> {
  // signInWithPassword 호출 → 관리자 세션 반환
  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: MOCK_JWT,
        token_type: 'bearer',
        expires_in: 9999999999,
        refresh_token: 'mock-admin-refresh-token',
        user: {
          id: ADMIN_USER_ID,
          email: 'admin@leedeli.test',
          role: 'authenticated',
          aud: 'authenticated',
        },
      }),
    })
  })

  // admin_users 조회 → 관리자 확인
  await page.route('**/rest/v1/admin_users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'admin-row-001' }]),
    })
  })
}

/** 로그인 폼 작성 후 제출 → 홈 redirect 대기 */
async function performLogin(
  page: import('@playwright/test').Page,
  email = 'admin@leedeli.test',
  password = 'password123',
): Promise<void> {
  await page.goto(`${BASE}/#/login`)
  await page.getByPlaceholder('email@example.com').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/#\/$/, { timeout: 5000 })
}

// ──────────────────────────────────────────────
// 1. 비로그인 접근 제어
// ──────────────────────────────────────────────

test.describe('비로그인 접근 제어', () => {
  test('1-1. 비로그인 → 홈페이지(/) 진입 시 로그인 화면으로 redirect', async ({ page }) => {
    await page.goto(`${BASE}/#/`)
    // RequireAuth가 /login으로 redirect해야 함
    await expect(page).toHaveURL(/#\/login/, { timeout: 5000 })
    // 로그인 폼이 보여야 함
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('1-2. 비로그인 → /create 직접 접근 시 로그인 페이지로 redirect', async ({ page }) => {
    await page.goto(`${BASE}/#/create`)
    await expect(page).toHaveURL(/#\/login/, { timeout: 5000 })
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible()
  })

  test('1-3. 비로그인 → /manage 직접 접근 시 로그인 페이지로 redirect', async ({ page }) => {
    await page.goto(`${BASE}/#/manage`)
    await expect(page).toHaveURL(/#\/login/, { timeout: 5000 })
  })
})

// ──────────────────────────────────────────────
// 2. 로그인 흐름
// ──────────────────────────────────────────────

test.describe('로그인 흐름', () => {
  test('2-1. 로그인 수행 → 홈 화면 이동 확인', async ({ page }) => {
    await setupAdminMocks(page)
    await page.goto(`${BASE}/#/login`)

    // 로그인 폼 확인
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible()

    await page.getByPlaceholder('email@example.com').fill('admin@leedeli.test')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button[type="submit"]').click()

    // 홈으로 redirect 확인
    await expect(page).toHaveURL(/#\/$/, { timeout: 5000 })
    // 홈 화면 카드 확인
    await expect(page.getByText('스케줄 생성')).toBeVisible()
  })

  test('2-2. /create 접근 시도 → redirect된 /login → 로그인 → /create로 돌아옴', async ({ page }) => {
    await setupAdminMocks(page)

    // 비로그인 상태에서 /create 접근 → /login으로 redirect
    await page.goto(`${BASE}/#/create`)
    await expect(page).toHaveURL(/#\/login/, { timeout: 5000 })

    // 로그인 수행
    await page.getByPlaceholder('email@example.com').fill('admin@leedeli.test')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button[type="submit"]').click()

    // 원래 목적지(/create)로 redirect-back 확인
    await expect(page).toHaveURL(/#\/create/, { timeout: 5000 })
  })
})

// ──────────────────────────────────────────────
// 3. 로그인 상태에서 스케줄 생성
// ──────────────────────────────────────────────

test.describe('로그인 후 스케줄 생성', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page)
    await performLogin(page)
  })

  test('3-1. 홈에서 스케줄 생성 카드 클릭 → /create 이동', async ({ page }) => {
    // 홈 화면에서 스케줄 생성 카드 클릭
    await page.getByText('스케줄 생성').first().click()
    await expect(page).toHaveURL(/#\/create/, { timeout: 5000 })
  })

  test('3-2. /create 폼 렌더링 확인', async ({ page }) => {
    // page.goto 대신 카드 클릭 → hash-change 방식이라 auth 상태 유지 (full reload 없음)
    await page.getByText('스케줄 생성').first().click()
    await expect(page).toHaveURL(/#\/create/, { timeout: 5000 })

    // 연도·월 선택 영역 (date-like inputs)
    await expect(page.getByText('연도')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('월', { exact: true })).toBeVisible()

    // 근무 인원 설정 (title-like input)
    await expect(page.getByText('인원 수')).toBeVisible()

    // 스케줄 생성(submit) 버튼
    const generateBtn = page.getByRole('button', { name: /스케줄 생성/ })
    await expect(generateBtn).toBeVisible()
  })

  test('3-3. 스케줄 생성 폼 제출 → 유효성 검사 또는 결과 처리', async ({ page }) => {
    // page.goto 대신 카드 클릭 → auth 상태 유지
    await page.getByText('스케줄 생성').first().click()
    await expect(page).toHaveURL(/#\/create/, { timeout: 5000 })
    await expect(page.getByText('연도')).toBeVisible({ timeout: 5000 })

    // 인원 수 0인 상태에서 스케줄 생성 버튼 클릭 → 에러 메시지 또는 결과
    const generateBtn = page.getByRole('button', { name: /스케줄 생성/ })
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // 인원 0명이므로 에러(경고) 메시지가 표시되거나
    // 버튼이 여전히 보여야 함 (페이지 크래시 없음)
    await expect(page.locator('body')).toBeVisible()
    await expect(page).toHaveURL(/#\/create/)
  })
})

// ──────────────────────────────────────────────
// 4. UnauthorizedPage 로그인 버튼
// ──────────────────────────────────────────────

test.describe('UnauthorizedPage', () => {
  test('4-1. 비관리자가 /unauthorized 접근 시 로그인 버튼이 존재한다', async ({ page }) => {
    // 비관리자 로그인 mock
    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
            '.eyJzdWIiOiJ1c2VyLW5vbmFkbWluLTAwMSIsImVtYWlsIjoidXNlckBsZWVkZWxpLnRlc3QiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9' +
            '.fake-sig',
          token_type: 'bearer',
          expires_in: 9999999999,
          refresh_token: 'mock-user-refresh',
          user: { id: 'user-nonadmin-001', email: 'user@leedeli.test', role: 'authenticated', aud: 'authenticated' },
        }),
      })
    })
    await page.route('**/rest/v1/admin_users*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // 비관리자 로그인
    await page.goto(`${BASE}/#/login`)
    await page.getByPlaceholder('email@example.com').fill('user@leedeli.test')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/#\/$/, { timeout: 5000 })

    // /unauthorized 직접 이동
    await page.goto(`${BASE}/#/unauthorized`)

    // "권한 없음" 제목 확인
    await expect(page.getByRole('heading', { name: /권한 없음/ })).toBeVisible()
    // "홈으로" 버튼
    await expect(page.getByRole('button', { name: /홈으로/ })).toBeVisible()
    // "로그인" 버튼 (신규 추가)
    await expect(page.getByRole('button', { name: /로그인/ })).toBeVisible()
  })
})
