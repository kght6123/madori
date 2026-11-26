/**
 * 画面動作テスト: キーボードショートカット
 * - Ctrl+Shift+N: 新規セッション
 * - Alt+1~9: セッション切替
 * - Ctrl+Shift+W: セッション削除
 * - Ctrl+Shift+M: メモパネル
 * - Ctrl+Shift+I: 通知パネル
 * - Ctrl+Shift+U: 未読ジャンプ
 */
import { test, expect } from '@playwright/test';

test.describe('キーボードショートカット', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Ctrl+Shift+N で新規セッションを作成できる', async ({ page }) => {
    await page.keyboard.press('Control+Shift+N');
    await expect(page.getByRole('tab')).toHaveCount(1, { timeout: 5000 });
  });

  test('Alt+1 で最初のセッションに切り替わる', async ({ page }) => {
    // Create 3 sessions
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+N');
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole('tab')).toHaveCount(3, { timeout: 5000 });

    // Switch to third (should be active after creation)
    await page.keyboard.press('Alt+1');
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
  });

  test('Alt+2 で2番目のセッションに切り替わる', async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Control+Shift+N');
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole('tab')).toHaveCount(2, { timeout: 5000 });

    await page.keyboard.press('Alt+1');
    await page.keyboard.press('Alt+2');

    const tabs = page.getByRole('tab');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
  });

  test('Ctrl+Shift+W でアクティブセッションを削除できる', async ({ page }) => {
    await page.keyboard.press('Control+Shift+N');
    await expect(page.getByRole('tab')).toHaveCount(1, { timeout: 5000 });

    await page.keyboard.press('Control+Shift+W');
    await expect(page.getByRole('tab')).toHaveCount(0, { timeout: 5000 });
  });

  test('Ctrl+Shift+M でメモパネルが開く', async ({ page }) => {
    await page.keyboard.press('Control+Shift+N');
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+Shift+M');
    await expect(page.getByRole('complementary', { name: /memo/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test('Ctrl+Shift+I で通知パネルが開く', async ({ page }) => {
    await page.keyboard.press('Control+Shift+I');
    await expect(
      page.getByRole('complementary', { name: /notifications/i })
    ).toBeVisible({ timeout: 3000 });
  });

  test('Ctrl+Shift+U で未読セッションにジャンプする', async ({ page }) => {
    // Create a session
    await page.keyboard.press('Control+Shift+N');
    await page.waitForTimeout(1000);

    // Trigger a notification
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type("printf '\\e]9;UnreadTest\\a'");
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Create second session (switch away)
    await page.keyboard.press('Control+Shift+N');
    await page.waitForTimeout(500);

    // Jump to unread
    await page.keyboard.press('Control+Shift+U');
    // First session should become active
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
  });
});
