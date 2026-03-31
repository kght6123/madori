/**
 * 画面動作テスト: セッションメモ
 * - メモパネル開閉
 * - メモ入力と localStorage 保存
 * - ページリロード後のメモ復元
 * - デバウンスによるサーバー PATCH
 */
import { test, expect } from '@playwright/test';

test.describe('セッションメモ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Create a session
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.waitForTimeout(500);
  });

  test('Ctrl+Shift+M でメモパネルが開閉される', async ({ page }) => {
    await page.keyboard.press('Control+Shift+M');
    const memoPanel = page.getByRole('complementary', { name: /memo/i });
    await expect(memoPanel).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Control+Shift+M');
    await expect(memoPanel).not.toBeVisible();
  });

  test('メモパネルにテキストを入力できる', async ({ page }) => {
    await page.keyboard.press('Control+Shift+M');
    const textarea = page.getByRole('textbox', { name: /memo/i });
    await expect(textarea).toBeVisible({ timeout: 3000 });

    await textarea.fill('Test memo content for session');
    await expect(textarea).toHaveValue('Test memo content for session');
  });

  test('メモがページリロード後も localStorage から復元される', async ({ page }) => {
    await page.keyboard.press('Control+Shift+M');
    const textarea = page.getByRole('textbox', { name: /memo/i });
    await expect(textarea).toBeVisible({ timeout: 3000 });

    const memoText = 'Persistent memo test content';
    await textarea.fill(memoText);
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open memo panel again
    await page.keyboard.press('Control+Shift+M');
    const restoredTextarea = page.getByRole('textbox', { name: /memo/i });
    await expect(restoredTextarea).toBeVisible({ timeout: 3000 });
    await expect(restoredTextarea).toHaveValue(memoText, { timeout: 5000 });
  });

  test('メモ編集後にサーバー PATCH リクエストが送信される', async ({ page }) => {
    await page.keyboard.press('Control+Shift+M');
    const textarea = page.getByRole('textbox', { name: /memo/i });
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Monitor PATCH requests
    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes('/api/sessions/'),
      { timeout: 5000 }
    );

    await textarea.fill('Server sync test memo');

    // PATCH should be sent after debounce (1000ms)
    const patchReq = await patchPromise;
    expect(patchReq.postDataJSON()).toMatchObject({ memo: 'Server sync test memo' });
  });
});
