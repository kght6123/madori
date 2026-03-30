/**
 * 画面動作テスト: スクロールバック保持
 * - タブ切替後にスクロールバックが保持される
 * - xterm.js インスタンスキャッシュの確認
 */
import { test, expect } from '@playwright/test';

test.describe('スクロールバック保持', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('セッション切替後にスクロールバックが保持される', async ({ page }) => {
    // Create first session
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(1500);

    // Fill terminal with output
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type('echo scrollback_marker_unique_abc');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify marker is visible
    await expect(page.locator('.xterm-rows')).toContainText('scrollback_marker_unique_abc', {
      timeout: 5000,
    });

    // Create second session
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(1000);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2, { timeout: 3000 });

    // Switch to second session
    await tabs.last().click();
    await page.waitForTimeout(500);

    // Switch back to first session
    await tabs.first().click();
    await page.waitForTimeout(500);

    // Scrollback should still be visible
    await expect(page.locator('.xterm-rows')).toContainText('scrollback_marker_unique_abc', {
      timeout: 5000,
    });
  });

  test('複数回セッション切替してもスクロールバックが消えない', async ({ page }) => {
    // Create 3 sessions
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /new/i }).first().click();
      await page.waitForTimeout(500);
    }

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3, { timeout: 5000 });

    // Type in first session
    await tabs.first().click();
    await page.waitForTimeout(500);
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type('echo persistent_content_test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Switch through all sessions
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    await tabs.nth(2).click();
    await page.waitForTimeout(300);

    // Return to first
    await tabs.first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.xterm-rows')).toContainText('persistent_content_test', {
      timeout: 5000,
    });
  });
});
