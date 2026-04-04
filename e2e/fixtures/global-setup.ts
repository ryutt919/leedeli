/**
 * global-setup.ts
 * Playwright global setup — Vite cold-start 워밍업
 *
 * 목적: 첫 번째 테스트 실행 전에 모든 주요 라우트를 사전 방문해
 *       Vite가 모든 청크를 미리 컴파일하도록 한다.
 *       이 단계 없이는 첫 번째 테스트에서 Vite 컴파일 시간(최대 15초)으로 인해
 *       React가 점진적으로 렌더링되며 DOM detach 현상이 발생한다.
 */
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5173'
const WARMUP_ROUTES = ['/', '/login', '/unauthorized', '/ingredients', '/preps', '/create', '/manage']

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  for (const route of WARMUP_ROUTES) {
    try {
      await page.goto(`${BASE}/#${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch {
      // 페이지 접근 실패해도 워밍업 계속 진행
    }
  }

  // 마지막 페이지의 모든 네트워크 요청 완료 대기
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  } catch {
    // networkidle 타임아웃도 무시 — 워밍업 목적이므로
  }

  await context.close()
  await browser.close()
}
