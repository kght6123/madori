/**
 * 画面動作テスト: 通知
 * - OSC 9 通知検出 → バッジ表示
 * - 通知パネル開閉
 * - 通知クリックでセッション切替
 * - 全既読機能
 */
import { test, expect } from '@playwright/test';

test.describe('通知', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Create a session and wait for terminal
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(1500);
    // Focus terminal
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.waitForTimeout(300);
  });

  test('OSC 9 通知でバッジが表示される', async ({ page }) => {
    // Send OSC 9 notification via printf in terminal
    await page.keyboard.type("printf '\\e]9;Test Alert\\a'");
    await page.keyboard.press('Enter');

    // Wait for notification badge to appear (unread count > 0)
    await expect(page.getByRole('status').first()).toBeVisible({ timeout: 5000 });
    const badgeText = await page.getByRole('status').first().textContent();
    expect(Number(badgeText)).toBeGreaterThan(0);
  });

  test('Ctrl+Shift+I で通知パネルが開閉される', async ({ page }) => {
    await page.keyboard.press('Control+Shift+I');
    await expect(page.getByRole('complementary', { name: /notifications/i })).toBeVisible({
      timeout: 3000,
    });

    await page.keyboard.press('Control+Shift+I');
    await expect(page.getByRole('complementary', { name: /notifications/i })).not.toBeVisible();
  });

  test('通知ベルクリックで通知パネルが開く', async ({ page }) => {
    const bell = page.getByRole('button', { name: /notifications/i });
    await bell.click();
    await expect(page.getByRole('complementary', { name: /notifications/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test('通知パネルに OSC 9 通知が表示される', async ({ page }) => {
    // Send OSC 9 notification
    await page.keyboard.type("printf '\\e]9;AlertBody\\a'");
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Open panel
    await page.keyboard.press('Control+Shift+I');
    const panel = page.getByRole('complementary', { name: /notifications/i });
    await expect(panel).toBeVisible({ timeout: 3000 });

    // Notification should appear
    await expect(panel).toContainText('Notification', { timeout: 5000 });
  });

  test('「Mark all read」で全通知を既読にできる', async ({ page }) => {
    // Send a notification
    await page.keyboard.type("printf '\\e]9;ReadTest\\a'");
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Open panel
    await page.keyboard.press('Control+Shift+I');
    await page.waitForTimeout(500);

    // Click mark all read
    const markAllBtn = page.getByRole('button', { name: /mark all read/i });
    await expect(markAllBtn).toBeVisible({ timeout: 3000 });
    await markAllBtn.click();

    // Badge count should be 0
    const badge = page.getByRole('status').first();
    const hasText = await badge.isVisible();
    if (hasText) {
      const text = await badge.textContent();
      expect(Number(text ?? '0')).toBe(0);
    }
  });
});
