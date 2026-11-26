/**
 * 画面動作テスト: Dead セッション
 * - exit コマンドでセッション終了
 * - "Session Ended" オーバーレイ表示
 * - タブがサイドバーに残る
 * - スクロールバックが閲覧可能
 * - 「Start New Session」で新セッション作成・メモ引き継ぎ
 */
import { test, expect } from '@playwright/test';

test.describe('Dead セッション', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Create a session and wait for terminal
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(1500);
  });

  test('exit コマンドでセッション終了後にオーバーレイが表示される', async ({ page }) => {
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.waitForTimeout(300);

    // Exit the shell
    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    // Wait for "Session Ended" overlay
    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });
  });

  test('セッション終了後もタブがサイドバーに残る', async ({ page }) => {
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.waitForTimeout(300);

    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });
    // Tab should still exist
    await expect(page.getByRole('tab')).toHaveCount(1);
  });

  test('セッション終了後もスクロールバックが閲覧できる', async ({ page }) => {
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.waitForTimeout(300);

    // Type something before exiting
    await page.keyboard.type('echo before_exit_marker');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });

    // Scrollback should still show previous output
    await expect(page.locator('.xterm-rows')).toContainText('before_exit_marker', {
      timeout: 3000,
    });
  });

  test('「Start New Session」で新しいセッションを開始できる', async ({ page }) => {
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });

    // Click Start New Session
    await page.getByRole('button', { name: /start new session/i }).click();

    // New session should be alive (no "Session Ended" overlay)
    await expect(page.getByText('Session Ended')).not.toBeVisible({ timeout: 5000 });
    // Terminal canvas should be visible
    await expect(page.locator('canvas.xterm-text-layer').first()).toBeVisible({ timeout: 5000 });
  });

  test('「Remove」でdeadセッションのタブを削除できる', async ({ page }) => {
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /remove/i }).click();
    await expect(page.getByRole('tab')).toHaveCount(0, { timeout: 3000 });
  });

  test('Dead セッションのメモが新セッションに引き継がれる', async ({ page }) => {
    // Open memo panel and write memo
    await page.keyboard.press('Control+Shift+M');
    const textarea = page.getByRole('textbox', { name: /memo/i });
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Memo to inherit');
    await page.waitForTimeout(500);

    // Exit session
    const termArea = page.locator('.xterm-container').first();
    await termArea.click();
    await page.keyboard.type('exit');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Session Ended')).toBeVisible({ timeout: 8000 });

    // Start new session
    await page.getByRole('button', { name: /start new session/i }).click();
    await page.waitForTimeout(1000);

    // Memo should be inherited
    await page.keyboard.press('Control+Shift+M');
    const newTextarea = page.getByRole('textbox', { name: /memo/i });
    await expect(newTextarea).toBeVisible({ timeout: 3000 });
    await expect(newTextarea).toHaveValue('Memo to inherit', { timeout: 5000 });
  });
});
