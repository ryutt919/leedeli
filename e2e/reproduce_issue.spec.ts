import { test, expect } from '@playwright/test';

test('reproduce issues with real account', async ({ page }) => {
  // 브라우저 콘솔 에러 캡처
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    }
  });

  // 1. 로그인 페이지로 이동 (HashRouter 반영)
  await page.goto('http://localhost:5173/#/login');

  // 2. 로그인 수행
  // Ant Design Input은 type="email"이 없을 수 있으므로 플레이스홀더 사용
  await page.waitForSelector('input[placeholder="email@example.com"]');
  await page.fill('input[placeholder="email@example.com"]', 'kimt919@naver.com');
  await page.fill('input[placeholder="비밀번호"]', 'kim9105'); 
  await page.click('button[type="submit"]');

  // 3. 홈 페이지 이동 대기
  await page.waitForURL('**/#/', { timeout: 10000 });
  console.log('로그인 성공: 홈 페이지로 이동했습니다.');

  // 4. 스케줄 생성 페이지 이동 및 무한 로딩 확인
  await page.goto('http://localhost:5173/#/create');
  try {
    // "기본 설정" 섹션이 나타나는지 확인
    await page.waitForSelector('text=기본 설정', { timeout: 10000 });
    console.log('스케줄 생성 페이지 로딩 성공');
  } catch (e) {
    console.log('스케줄 생성 페이지 무한 로딩 또는 로딩 실패 감지');
    await page.screenshot({ path: 'test-results/real-auth-loading-issue.png' });
    
    const isSpinVisible = await page.isVisible('.ant-spin');
    console.log(`Ant Design Spin 표시 여부: ${isSpinVisible}`);
  }

  // 5. 재료 추가 시도
  await page.goto('http://localhost:5173/#/ingredients');
  await page.click('text=추가');
  await page.fill('input[placeholder="예) 우유"]', '실제 계정 테스트 재료');
  await page.locator('id=purchasePrice').fill('5000');
  await page.locator('id=purchaseUnit').fill('10');
  await page.click('button:has-text("저장")');

  try {
    await page.waitForSelector('text=실제 계정 테스트 재료', { timeout: 5000 });
    console.log('재료 추가 성공');
  } catch (e) {
    console.log('재료 추가 실패');
    await page.screenshot({ path: 'test-results/real-ingredient-fail.png' });
  }

  // 6. 프렙 추가 시도
  await page.goto('http://localhost:5173/#/preps');
  await page.click('text=추가');
  await page.fill('input[placeholder="예) 토마토 소스"]', '실제 계정 테스트 프렙');
  await page.click('button:has-text("저장")');

  try {
    await page.waitForSelector('text=실제 계정 테스트 프렙', { timeout: 5000 });
    console.log('프렙 추가 성공');
  } catch (e) {
    console.log('프렙 추가 실패');
    await page.screenshot({ path: 'test-results/real-prep-fail.png' });
  }
});
